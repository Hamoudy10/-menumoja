/**
 * Diagnostic: verify knowledge ingestion + full-text retrieval.
 * Usage (from backend/): npm run db:check-knowledge -- "mpesa setup"
 * Prints counts, sample titles and matching sources only (no content dumps).
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/config/database';

async function main(): Promise<void> {
  const query = process.argv[2] || 'mpesa setup';

  const [count, sample] = await Promise.all([
    prisma.knowledgeChunk.count(),
    prisma.knowledgeChunk.findMany({ take: 5, select: { title: true, source: true } }),
  ]);

  const rows = await prisma.$queryRaw<Array<{ title: string; source: string }>>`
    SELECT title, source
    FROM "knowledge_chunks"
    WHERE to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
        @@ websearch_to_tsquery('english', ${query})
    ORDER BY ts_rank(
      to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')),
      websearch_to_tsquery('english', ${query})
    ) DESC
    LIMIT 5
  `;

  console.log(JSON.stringify({ count, sample, query, matches: rows }, null, 2));
}

main()
  .catch((error) => {
    console.error('Knowledge check failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
