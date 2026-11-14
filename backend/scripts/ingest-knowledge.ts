/**
 * E2 — ingest product/help documentation into `knowledge_chunks`.
 *
 * Security: only a curated, user-facing set of docs is ingested. Internal
 * audit/gap-analysis files are intentionally excluded, and no `.env` values or
 * secrets are read.
 *
 * Usage (from backend/): npm run db:ingest-knowledge
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../src/config/database';

const REPO_ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');

/** Curated user-facing docs. Internal audit/gap-analysis files are excluded. */
const INCLUDED_DOCS = [
  'FEATURES.md',
  'MPESA_INTEGRATION.md',
  'SETUP_SCENARIOS.md',
  'ETIMS.md',
  'SYSTEM_OVERVIEW.md',
  'AI_COMMAND_LAYER.md',
  'MULTI_STEP_WORKFLOWS.md',
  'JARVIS_KNOWLEDGE.md',
  'PROACTIVE_ALERTS.md',
  'portfolio/README.md',
];

const CATEGORY = 'product-docs';
const MAX_CHUNK_CHARS = 1400;

function splitLongSection(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > MAX_CHUNK_CHARS && current.trim()) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function sectionsFor(fileContent: string): Array<{ title: string; content: string }> {
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const parts = normalized.split(/\n(?=## )/);

  const sections: Array<{ title: string; content: string }> = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
    const title = headingMatch ? headingMatch[1].trim() : 'Overview';
    for (const chunk of splitLongSection(trimmed)) {
      if (chunk.length < 80) continue; // skip trivial sections
      sections.push({ title, content: chunk });
    }
  }
  return sections;
}

async function main(): Promise<void> {
  let files = 0;
  let chunks = 0;

  for (const relative of INCLUDED_DOCS) {
    const absolute = path.join(DOCS_DIR, relative);
    if (!fs.existsSync(absolute)) {
      console.warn(`Skipping missing doc: docs/${relative}`);
      continue;
    }

    const content = fs.readFileSync(absolute, 'utf8');
    const source = `docs/${relative}`;
    const sections = sectionsFor(content);

    // Replace the previous version of this source to avoid stale chunks.
    await prisma.knowledgeChunk.deleteMany({ where: { source, restaurantId: null } });

    for (const section of sections) {
      const contentHash = crypto
        .createHash('sha256')
        .update(`${source}\n${section.title}\n${section.content}`)
        .digest('hex');

      await prisma.knowledgeChunk.create({
        data: {
          restaurantId: null,
          source,
          title: section.title.slice(0, 200),
          category: CATEGORY,
          content: section.content,
          contentHash,
        },
      });
      chunks += 1;
    }

    files += 1;
    console.log(`Ingested docs/${relative}: ${sections.length} chunk(s)`);
  }

  console.log(`Done. ${files} file(s), ${chunks} knowledge chunk(s).`);
}

main()
  .catch((error) => {
    console.error('Knowledge ingestion failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
