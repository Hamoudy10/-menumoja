# Menu Moja — Product Knowledge (E2) & Feedback Loop (E3)

> **Status:** Implemented.
> **Related:** `docs/JARVIS_KNOWLEDGE.md`, `backend/src/ai/tools/knowledge.tools.ts`,
> `backend/scripts/ingest-knowledge.ts`.

---

## 1. What it does

Jarvis can answer **how-to / setup / policy / troubleshooting** questions by
retrieving relevant product documentation and restaurant FAQs, then answering
with **citations**.

Examples:

- “How do I set up M-Pesa?”
- “How does offline mode work?”
- “What is included in the Business plan?”
- “Where can I find receipts?”

Live business data (orders, stock, customers) still comes from **tools**, not
retrieval. This separation is deliberate: structured data changes constantly and
must be tenant-scoped; documentation changes rarely and is safe to retrieve.

---

## 2. Architecture (v1: lexical retrieval)

```
docs/*.md / restaurant FAQs
        │ ingest (chunk + hash)
        ▼
PostgreSQL knowledge_chunks  ── full-text GIN index ──┐
                                                      │
POST /ai/command → search_knowledge tool ── websearch_to_tsquery (parameterized)
                                                      │
                                     top 4 chunks + tenant FAQs
                                                      ▼
                              generateKnowledgeAnswer (cite [1], [2], …)
```

Why lexical (no embeddings) for v1:

- no extra provider/key or model download,
- deterministic and fast,
- works on the existing Postgres,
- safe: the query is parameterized and tenant-scoped.

The schema is ready to add **pgvector** embeddings later without changing the
tool contract or UI.

### Tables

- `knowledge_chunks` — `source`, `title`, `category`, `content`,
  `content_hash` (unique), nullable `restaurant_id`.
  - `restaurant_id IS NULL` → global product documentation.
  - `restaurant_id = <tenant>` → tenant-specific knowledge.
- `ai_command_feedback` — rating (`UP`/`DOWN`), tool, conversation, comment.

GIN index:
```sql
CREATE INDEX "knowledge_chunks_fts_idx"
ON "knowledge_chunks" USING GIN
(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
```

---

## 3. Ingestion

```bash
cd backend
npm run db:ingest-knowledge
```

- Ingests a **curated user-facing set** from `docs/` (features, M-Pesa setup,
  hosting, eTIMS, system overview, AI command docs).
- **Excludes** internal audit/gap-analysis files and `test-menu-data.md`.
- Splits by headings, chunks to ~1400 chars at paragraph boundaries, hashes
  content, replaces the previous version of each source.
- Never reads `.env` values or secrets.

Verify:
```bash
npm run db:check-knowledge -- "mpesa setup"
```

---

## 4. Retrieval & answer

`search_knowledge` is a normal read tool (admin-only, like the rest):

- query, optional limit (1–6),
- parameterized `websearch_to_tsquery` over global + tenant chunks,
- merges up to 3 matching `RestaurantFaq` rows,
- returns `{ title, source, content }` excerpts,
- the answer prompt requires citations `[1]`, `[2]` and forbids inventing steps,
- the UI renders a **Knowledge** card listing the sources.

If nothing matches, Jarvis says it couldn’t find it and suggests support —
it does not guess.

---

## 5. Feedback loop (E3)

- Every answer has **👍 / 👎** buttons in the Jarvis panel.
- `POST /api/v1/ai/command/feedback` stores `{ conversationId?, tool?, rating }`.
- Feedback is tenant-scoped; a conversation belonging to another tenant is
  rejected (404).
- Super-admins can review recent feedback:
  `GET /api/v1/admin/command-feedback?rating=UP|DOWN`.
- The endpoint is rate-limited and uses the same admin-only command access.

Use this to find misrouted prompts and add them to
`backend/tests/evals/command-prompts.ts`.

---

## 6. Security invariants

- Retrieval is parameterized SQL; user text is never interpolated.
- Tenant scope: global docs (`restaurant_id IS NULL`) + the caller’s restaurant
  only. No cross-tenant chunks or FAQs.
- Only curated docs are ingested; internal audit files are excluded.
- No `.env` values, credentials, M-Pesa passkeys or tokens are ingested.
- The `get_settings` tool still excludes secrets; knowledge docs contain only
  variable **names**, not values.
- Knowledge and feedback routes inherit the admin-only access policy.
- Feedback comments are capped at 1000 chars.

---

## 7. Limitations & next steps

- Lexical retrieval misses pure synonyms (“till” vs “paybill”) unless the docs
  use the same wording. Add `pgvector` embeddings (OpenAI or local) as a hybrid
  ranker when a key/model is available.
- The FTS query uses `websearch_to_tsquery` AND semantics; broad questions may
  return few chunks. A fallback `ILIKE` pass could improve recall.
- Re-ingest after editing docs; the script replaces each source’s chunks.
- Next: use feedback to build a per-domain eval set and a “most failed
  questions” report.
