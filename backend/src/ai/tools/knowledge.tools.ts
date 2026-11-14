import { z } from 'zod';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import type { Tool } from './types';

/**
 * E2 — product/help knowledge retrieval.
 *
 * Uses PostgreSQL full-text search over `knowledge_chunks` (global product
 * docs) plus the restaurant's own FAQs. The query is fully parameterized and
 * tenant-scoped: global chunks (`restaurant_id IS NULL`) + this restaurant's
 * chunks only.
 *
 * Why lexical instead of embeddings for v1: no extra provider/key, no model
 * download, deterministic, and it works on the existing Postgres. The schema is
 * ready to add pgvector embeddings later without changing the tool contract.
 */

interface KnowledgeRow {
  id: string;
  source: string;
  title: string;
  content: string;
}

export const knowledgeTools: Tool[] = [
  {
    key: 'search_knowledge',
    label: 'Product knowledge',
    description: 'Read-only: search Menu Moja help/product documentation and the restaurant FAQs. Use for how-to, setup, feature, billing, policy and troubleshooting questions (e.g. "how do I set up M-Pesa?", "how does offline mode work?", "what is included in the Business plan?").',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      query: z.string().min(2).max(300),
      limit: z.coerce.number().int().min(1).max(6).default(4),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the operator wants to know' },
        limit: { type: 'number', description: '1-6 sources, default 4' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({
      ok: true,
      args,
      preview: { summary: `Knowledge search: ${String(args.query)}` },
    }),
    run: async (ctx, args) => {
      const query = String(args.query).trim();
      const limit = Number(args.limit || 4);

      let chunks: KnowledgeRow[] = [];
      try {
        // Parameterized; user text is never interpolated into SQL.
        chunks = await prisma.$queryRaw<KnowledgeRow[]>`
          SELECT id, source, title, content
          FROM "knowledge_chunks"
          WHERE ("restaurant_id" IS NULL OR "restaurant_id" = ${ctx.restaurantId}::uuid)
            AND to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
                @@ websearch_to_tsquery('english', ${query})
          ORDER BY ts_rank(
            to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')),
            websearch_to_tsquery('english', ${query})
          ) DESC
          LIMIT ${limit}
        `;
      } catch (error) {
        logger.warn('Knowledge retrieval failed; falling back to FAQs', { error: (error as Error).message });
      }

      const faqs = await prisma.restaurantFaq.findMany({
        where: {
          restaurantId: ctx.restaurantId,
          isActive: true,
          OR: [
            { question: { contains: query, mode: 'insensitive' } },
            { answer: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 3,
        select: { question: true, answer: true },
      });

      const results = [
        ...chunks.map((chunk) => ({
          title: chunk.title,
          source: chunk.source,
          content: String(chunk.content || '').slice(0, 1200),
        })),
        ...faqs.map((faq) => ({
          title: faq.question,
          source: 'Restaurant FAQ',
          content: String(faq.answer || '').slice(0, 1200),
        })),
      ].slice(0, limit);

      return { data: { query, results } };
    },
  },
];
