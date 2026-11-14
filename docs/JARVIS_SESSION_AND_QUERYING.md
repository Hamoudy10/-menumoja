# Jarvis — Session, Context & Progressive Querying

> **Status:** Session persistence + progressive read analysis implemented.
> **Related:** `docs/JARVIS_KNOWLEDGE.md`, `docs/AI_COMMAND_LAYER.md`.

---

## 1. Session & context (fixed)

### What was wrong
- The router keyed `<Routes>` by `location.pathname`, so every dashboard tab
  switch remounted the whole layout. Jarvis (and its conversation) reset.
- The chat lived only in component state, so a reload lost everything.
- Answer generation did not receive prior turns; only the planner did.

### What changed
- **No route remount:** `src/App.tsx` no longer keys `<Routes>` by pathname.
  The dashboard layout (and Jarvis) persist across tab switches.
- **Persistent session:** `src/store/useJarvisStore.ts` persists
  `conversationId`, messages and panel state in `localStorage` (capped at 40
  messages).
- **Restore:** the panel restores immediately on reload; if only a conversation
  id survives, it reloads the text history from the backend.
- **New chat:** the header has a reset button; it starts a fresh conversation.
- **Account safety:** the session is keyed to the restaurant. It resets when the
  restaurant changes and is cleared on logout, so one account never sees
  another’s chat.
- **Context-aware answers:** both `generateManagerAnswer` and
  `generateKnowledgeAnswer` now receive the recent conversation history, so
  follow-ups like “make it 15%” work.

Security note: the transcript is stored in browser `localStorage` (the app
already stores JWTs there). It contains business data, not secrets; logging out
clears it.

---

## 2. Progressive read analysis

The command layer now runs a bounded **query → inspect → refine** loop:

1. The planner selects one or more **read** tools.
2. Each tool runs with server-side validation and entity resolution.
3. The planner receives the **tool results so far** and may:
   - return no tool (enough data), or
   - request another read query (up to **3 rounds**).
4. Duplicate queries (`tool + args`) are skipped.
5. The final answer is combined from all gathered results.

Example:

> “Which dish gives us the best margin?”
> 1. `get_top_items` → best sellers
> 2. `get_recipe_costs` (refined by the result) → margin per dish
> 3. final grounded answer + cards

Writes are still **propose-only**; mixed read+write requests ask the operator to
split the report from the change. The daily token budget still applies; if it is
exhausted, Jarvis falls back to deterministic summaries/structured data.

---

## 3. Why not raw SQL — and the safe way to add it

Giving an LLM `SELECT` access to production tables is dangerous:

- prompt injection can attempt cross-tenant reads;
- it can write/DDL unless the role prevents it;
- expensive queries can exhaust the pool;
- schema drift breaks prompts;
- errors may leak table/column names.

The current design is **tool-grounded**: the model can only use vetted,
parameterized, tenant-scoped queries. This is why it is safe.

If you want a true “ask anything” SQL explorer, the safe blueprint is:

1. **Read-only role** (`jarvis_ro`) with `SELECT` only on **tenant-scoped
   views**, never on base tables.
2. **Views filter by session tenant**:
   ```sql
   CREATE VIEW v_orders AS
   SELECT * FROM orders
   WHERE restaurant_id = current_setting('app.restaurant_id')::uuid;
   ```
3. **Transaction guards**:
   ```sql
   SET TRANSACTION READ ONLY;
   SET LOCAL app.restaurant_id = '<tenant>';
   SET LOCAL statement_timeout = '3s';
   ```
4. **SQL validation**: parse the statement, allow only a single `SELECT`,
   allowlist view names, reject system catalogs, `pg_*`, functions with side
   effects; enforce a `LIMIT`.
5. **Separate Prisma client** using the read-only connection string; never the
   app’s write client.
6. **Audit + rate limit + error masking**, and a feature flag.
7. **Tests**: cross-tenant isolation, write/DDL rejection, timeout, row limits.

This requires DB role/view setup and a second connection string. It is
deliberately **not enabled by default**; enabling it without those controls
would be a security regression.

---

## 4. Practical expectation

- “Whole-system” questions covered by the 27 tools → high accuracy, with
  progressive refinement.
- Documentation/help questions → RAG with citations.
- Arbitrary SQL-shaped questions outside the tools → Jarvis says what it can
  answer instead of guessing. Add a tool (or the gated SQL explorer) when a
  recurring gap appears.

Feedback (👍/👎) is stored and reviewable by super-admins; use it to find the
gaps that deserve a new tool.
