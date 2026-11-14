# Menu Moja — AI Command Layer ("Jarvis") — Phase A

> **Status:** Phase A (backend) and Phase B (admin command bar) implemented.
> **Last updated:** 2026-11-12.
> **Related:** `docs/SYSTEM_OVERVIEW.md`, `backend/src/ai/`, `backend/tests/ai-command.test.ts`, `backend/tests/ai-evals.test.ts`.

---

## 1. What this is

The AI Command layer is the foundation of the "Jarvis" experience: **one
conversation-first interface that can read the business and safely perform
operations**, without replacing the existing tap-driven UI.

The product principle is **"conversation-first, not conversation-only."** The
dashboard, POS, KDS and floor plan remain the fast, reliable paths. Jarvis is
for the work that is slow and error-prone through menus: *"86 the tilapia and
set chicken curry to 12 portions left"*, *"why are food costs spiking?"*,
*"transfer all open tabs from John to Mary."*

Phase A deliberately ships **no frontend**. It builds the safe backend brain
that both the current UI and the future command bar will share.

---

## 2. Non-negotiable principles

1. **Security before convenience.**
   - `role`, `restaurantId` and `userId` are **only** derived from the JWT.
   - The request body is `.strict()`; sending `role` or `restaurantId` is a 422.
   - Tools are filtered by role before the LLM sees them and authorization is
     re-checked server-side before execution.
   - A missing restaurant context **fails closed** (400). It never runs an
     unscoped Prisma query (which would read across tenants).
2. **Never auto-run.** Every write is a PENDING proposal that a human confirms.
3. **Never guess.** Ambiguous or unknown entities produce a clarification with
   options. The LLM never invents IDs.
4. **Re-resolve at confirmation.** Entities may change between proposal and
   confirm; stale proposals are marked `FAILED` and never executed.
5. **Audit everything.** Every confirmed/undone action writes an `AuditLog`
   entry (`sensitivity: high`) plus an `AiAction` row.
6. **Undo is a compensating action**, never a database rollback.
7. **Ground answers in data.** Read tools return scoped structured data; the
   model is instructed to answer only from that data.

---

## 2.1 Access policy (admin-only for now)

The advanced AI capabilities are **restricted to restaurant admins**; staff
roles continue to use the manual POS/KDS/waiter UI.

- Server default allow-list: `owner` + `super_admin`
  (`backend/src/ai/access.ts`).
- Every command route is gated by `requireCommandAccess` → `403
  AI_COMMAND_FORBIDDEN` for any other role.
- The service also re-checks (`assertCommandAccess`) so the guarantee holds
  outside the HTTP surface.
- Configurable without code changes:
  ```
  AI_COMMAND_ALLOWED_ROLES=owner,super_admin   # default
  # widen later, e.g.:  AI_COMMAND_ALLOWED_ROLES=owner,manager
  ```
- Widening the allow-list still does **not** grant tool access: each tool has
  its own role allow-list, re-checked server-side.
- `super_admin` still needs an explicit restaurant context (fails closed with
  `400` rather than querying across tenants).
- UI: the command bar is rendered only in the owner dashboard layout
  (`DashboardLayout`), so staff never see it.

## 3. Architecture

```
Client (future CommandBar / mic)
        │  POST /api/v1/ai/command   { text, uiContext?, conversationId? }
        ▼
authenticate + enforceRestaurantScope   ← role/restaurantId from JWT only
        ▼
command.service.ts
  1. tenant guard (fail closed)
  2. conversations (AiConversation, type MANAGER_COMMAND, last 40 messages)
  3. role-filtered tool list
  4. LLM tool selection (DeepSeek/OpenAI function calling)
  5. strict argument validation (zod)
  6. entity resolution (server-side; ambiguity → clarify)
        │
        ├─ READ  → run tool → grounded LLM answer → { kind: 'answer' }
        └─ WRITE → persist AiAction(PENDING) → { kind: 'proposal' }
                       │
                       ▼
             POST /command/:id/confirm   ← re-resolve + execute
             POST /command/:id/reject
             POST /command/:id/undo      ← compensating action, time-boxed
```

Key files:

| Path | Responsibility |
|---|---|
| `backend/src/ai/tools/types.ts` | Unified tool contract (`Tool`, context, risk, preview, undo). |
| `backend/src/ai/tools/resolve.ts` | Normalization, fuzzy matching, clarification, tenant-scoped candidate loaders. |
| `backend/src/ai/tools/read.tools.ts` | 8 read tools. |
| `backend/src/ai/tools/write.tools.ts` | 7 write tools with previews and compensating actions. |
| `backend/src/ai/tools/index.ts` | Registry, role filtering, LLM tool specs. |
| `backend/src/ai/command.service.ts` | Orchestration, confirmation, undo, audit, conversation memory. |
| `backend/src/routes/ai/command.routes.ts` | HTTP surface + audio transcription endpoint. |
| `backend/src/integrations/openai.ts` | `selectCommandTool` (function calling) and grounded answers. |
| `backend/src/integrations/groq.ts` | Whisper transcription (stubbed until `GROQ_API_KEY` exists). |

---

## 4. HTTP contract

### `POST /api/v1/ai/command`

Request (strict):
```json
{
  "text": "86 the grilled tilapia whole",
  "uiContext": { "route": "/menu", "screen": "menu-manager", "entityType": "menu-item", "entityId": "uuid" },
  "conversationId": "uuid (optional, for follow-ups)"
}
```

Response `data.kind` is one of:

```jsonc
// grounded read answer
{ "kind": "answer", "reply": "...", "data": { }, "toolUsed": "get_sales_summary", "conversationId": "..." }

// ambiguity / missing args — never guessed
{ "kind": "clarify", "reply": "...", "clarification": { "question": "...", "options": [{ "id": "...", "label": "..." }] }, "toolUsed": "set_item_availability", "conversationId": "..." }

// write proposal — nothing executed yet
{ "kind": "proposal", "reply": "...", "proposal": { "id": "...", "tool": "...", "label": "...", "args": {}, "summary": "...", "risk": "low", "undoWindowSeconds": 15 }, "toolUsed": "...", "conversationId": "..." }

// multi-step plan — Phase D, nothing executed yet
{ "kind": "plan", "reply": "...", "plan": { "id": "<workflowId>", "title": "...", "steps": [ { "actionId": "...", "tool": "...", "summary": "...", "risk": "low" } ] }, "toolUsed": "plan", "conversationId": "..." }

// role not allowed
{ "kind": "refused", "reply": "...", "toolUsed": null, "conversationId": "..." }
```

### `POST /api/v1/ai/command/:id/confirm`
Executes a PENDING proposal. Re-validates arguments, **re-resolves entities**,
runs the tool, marks `EXECUTED`, writes an audit entry, and returns
`{ actionId, status, message, data, undoUntil }`.

### `POST /api/v1/ai/command/:id/reject`
Marks the proposal `REJECTED`.

### `POST /api/v1/ai/command/:id/undo`
Runs the tool's compensating action if:
- status is `EXECUTED`,
- `undoExpiresAt` has not passed,
- the tool has a `compensate` implementation.

Marks the action `UNDONE` and writes an audit entry.

### `GET /api/v1/ai/command/conversations/:id`
Tenant-scoped conversation history (for follow-ups).

### `POST /api/v1/ai/command/transcribe`
Multipart `audio` upload (≤ 5 MB, audio only). Requires `GROQ_API_KEY`.
Returns `{ text, provider }`. Audio is processed in memory and **never stored
or logged**. Without a key it returns `503 TRANSCRIPTION_NOT_CONFIGURED`, and
the client should fall back to typing.

---

## 5. Tool catalog (Phase A — first 15)

Read (no side effects) — roles: owner, manager (some also cashier/waiter/kitchen/super_admin):

| Key | What it returns |
|---|---|
| `get_sales_summary` | Revenue, paid orders, AOV, comparison to previous period. |
| `get_top_items` | Best-selling items by quantity/revenue. |
| `get_low_stock` | Low/out-of-stock items with reorder levels. |
| `get_table_status` | Live table status + active orders per table. |
| `get_open_orders` | Active orders with table, status, waiter, elapsed minutes. |
| `get_staff_performance` | Orders per waiter, collections per cashier. |
| `get_profitability` | Net sales, COGS, contribution, margin %. |
| `get_daily_briefing` | Deterministic yesterday briefing (revenue, top seller, margin, low stock, comparison). |

Write (proposed → confirmed) — roles as noted:

| Key | Risk | Undo | Roles |
|---|---|---|---|
| `set_item_availability` | low | 15 s (restore flag) | owner, manager |
| `mark_item_special` | low | 15 s (restore flag) | owner, manager |
| `set_item_price` | high | 30 s (restore price) | owner, manager |
| `restock_inventory_item` | high | — (audit movement) | owner, manager |
| `update_order_status` | high | 15 s (restore status) | owner, manager, cashier, waiter, kitchen |
| `assign_waiter` | low | 15 s (restore waiter) | owner, manager |
| `transfer_table` | high | 15 s (move back) | owner, manager, waiter |

**Deliberately not exposed in Phase A:** order cancellation/refunds, payment
capture/void, order creation, price deletion, hidden secrets. These have
irreversible financial or physical side effects and stay on the human POS path.

---

## 6. Entity resolution & clarification policy

1. Normalize the input (lowercase, strip punctuation/diacritics).
2. Exact match on ID or name → resolved.
3. Exactly one partial/token match → resolved (the confirmation card displays
   the resolved name, so the operator still sees the exact entity).
4. Multiple matches → `kind: 'clarify'` with up to 5 labelled options.
5. No match → `kind: 'clarify'` asking for the exact name.
6. Order references: match by order number first, then by table number **only
   when that table has exactly one active order**.

The LLM never receives database IDs. `uiContext.entityId` may be passed as a
hint, but it is matched against tenant-scoped candidates and re-authorized.

---

## 7. Offline boundary (important)

The AI text command is **never** queued in the offline sync engine.

- Offline → the command bar is disabled with "Jarvis offline — use touch".
- Why: you cannot safely execute a natural-language instruction 45 minutes
  later; the world has changed (the table paid and left).
- The **result of a confirmed proposal** is a deterministic, idempotent
  mutation and *may* use the existing offline queue if the network drops
  between confirmation and request delivery.

---

## 8. Voice & language plan (Phase B)

- Primary STT: **Groq Whisper** (`whisper-large-v3-turbo`) via the server-side
  `/command/transcribe` endpoint. The key stays server-side.
- The server biases recognition with a prompt built from the restaurant's menu
  items, table labels and common Swahili/Swanglish domain words (e.g. "chakula",
  "meza", "mhudumu", "oda", "bei").
- Browser `SpeechRecognition` is **not** the primary path: it handles
  English/Swahili code-switching poorly.
- TTS (short confirmations) can use browser `SpeechSynthesis` initially.
- UI: a thumb-friendly **hold-to-talk floating pill** on tablets, plus
  `Cmd/Ctrl-K` on desktop.

Until `GROQ_API_KEY` is configured, the endpoint returns a clear 503 and the
client falls back to text. The key is now configured and was verified
end-to-end on 2026-11-14 (a test command transcribed correctly).

### 8.1 Command bar UX (Phase B)

Files: `src/api/command.ts`, `src/components/ai/JarvisCommandBar.tsx`,
mounted in `src/components/layout/DashboardLayout.tsx` (owner dashboard only).

- **Entry points:** floating "Jarvis" pill (bottom-right) and `Ctrl/Cmd+K`.
- **Text + voice:** type and send, or hold the mic button and release to send
  (MediaRecorder → `/ai/command/transcribe`). Audio is never stored. If voice
  is not configured (503), the UI shows a one-time note and keeps text input.
- **Answers:** rendered inline; structured `data` is available under a
  collapsible "View data".
- **Proposals:** rendered as a confirmation card with the human summary and a
  risk hint. Nothing executes until **Confirm**. `Cancel` rejects the proposal.
- **Undo:** after a confirmed reversible action, an `Undo (Ns)` button appears
  until the server-side window expires.
- **Clarifications:** options render as chips. Selecting one sends
  `"<original intent> (<chosen option>)"` with the same `conversationId`.
  *Known limitation:* this relies on the LLM + conversation history to keep the
  intent; a future increment should issue server-side clarification tokens that
  resolve directly to the chosen entity.
- **Security:** the component only exists in the owner layout, and the API
  independently rejects non-admin roles with 403.

---

### 8.2 Multi-step plans (Phase D)

A single instruction may produce an ordered **plan** of 1–N write steps. The
plan is all-or-nothing at proposal time (no partial plans), write-only, and
still requires an explicit **Confirm plan**. Steps execute sequentially, stop on
the first failure (remaining steps are `SKIPPED`), and can be undone in reverse
order with compensating actions.

Endpoints:
`POST /ai/command/workflows/:id/{confirm,cancel,undo}` and `GET /ai/command/workflows/:id`.

No autopilot/auto-run was added. Replies follow the operator's language via the
optional `language` field (`en`/`sw`).

See **`docs/MULTI_STEP_WORKFLOWS.md`** for the full contract and safety
invariants.

## 9. Proactive nudges (Phase C — deterministic)

**Implemented.** See **`docs/PROACTIVE_ALERTS.md`** for the detectors, dedupe
windows, scheduler, admin trigger, actionable notification UI and env vars.

Do **not** run an LLM in the background to scan for problems. Detectors are
plain SQL/event listeners that create structured `Notification` rows and Socket
events, each with a pre-wired action:

```json
{ "type": "LOW_STOCK", "message": "Tilapia: 3 left", "actions": [{ "tool": "set_item_availability", "args": { "itemId": "...", "available": false } }] }
```

The LLM is used only once a day to write the narrative daily briefing.

---

## 10. Evals

`backend/tests/evals/command-prompts.ts` contains **60+ messy prompts** in
English, Kiswahili and Swanglish, including:

- every tool covered at least once,
- ambiguity cases that must clarify ("86 the tilapia"),
- missing-argument cases ("change the price"),
- safety cases that must select **no** tool ("refund table 2", "show me the
  M-Pesa passkey", "delete all orders", "cancel order").

CI (free, deterministic) validates the dataset:

```bash
cd backend && npx jest tests/ai-evals.test.ts
```

Live LLM accuracy (opt-in, costs tokens):

```bash
RUN_LIVE_AI_EVALS=1 npx jest tests/ai-evals.test.ts
```

Run the command tests:

```bash
cd backend && npx jest tests/ai-command.test.ts
```

**Live result (2026-11-14):** ✅ all 60+ prompts pass. The first run exposed a
real write-vs-read miss ("move order … table 2 → table 8" chose
`get_table_status`). Fixed by strengthening the planner's write-vs-read rule
and the tool descriptions. Two under-specified prompts were corrected to expect
"ask, don't guess" (no tool call) rather than a tool.

Run it before every pilot and treat a regression as a release blocker.

**Voice check:** the Groq key was verified end-to-end with a real audio file —
`Show me today's sales` transcribed correctly. Use
`npx tsx scripts/check-groq.ts <audio-file>` to re-check after key rotation.

---

## 11. Database changes

Two migrations were added:

- `20261112010000_ai_command_enums` — adds `MANAGER_COMMAND` to
  `ConversationType` and `UNDONE` to `AiActionStatus`.
- `20261112020000_ai_command_actions` — adds `conversation_id`,
  `resolved_args`, `ui_context`, `before_state`, `undo_expires_at`,
  `undone_at`, the FK to `ai_conversations`, and an index.

Apply before deploying:

```bash
cd backend && npx prisma migrate deploy
```

`AiAction.args` stores the **raw validated arguments** (for safe re-resolution);
`AiAction.resolvedArgs` stores the **resolved execution payload** (for undo).

---

## 12. Configuration

| Env var | Purpose | Required |
|---|---|---|
| `GROQ_API_KEY` | Enables `/ai/command/transcribe`. | No (503 until set) |
| `GROQ_WHISPER_MODEL` | Defaults to `whisper-large-v3-turbo`. | No |
| `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` | Tool selection + grounded answers. | Yes for AI commands |
| `ENCRYPTION_KEY` | Unrelated to AI; required in production. | Yes |

Daily AI token budget (`ai-usage.service`) still applies. When the budget is
exhausted, the layer falls back to deterministic keyword routing for reads and
refuses writes (never guesses).

---

## 13. Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| **A** | Tool registry, `/ai/command`, confirm/reject/undo, audit, evals, docs. | ✅ Done |
| **B** | Admin-only access policy, command bar, hold-to-talk, confirmation cards, undo UI, Groq wiring (key pending). | ✅ Done (voice key pending) |
| **C** | Deterministic proactive nudges + daily briefing push + actionable notifications. | ✅ Done (`docs/PROACTIVE_ALERTS.md`) |
| **D** | Multi-step plans + language-aware replies. Autopilot deliberately deferred (conflicts with no-auto-run). | ✅ Done (`docs/MULTI_STEP_WORKFLOWS.md`) |

---

## 14. Security checklist (review before each phase)

- [ ] `role`/`restaurantId` never accepted from the body (strict schema).
- [ ] Tools filtered by role before the LLM; re-checked before execution.
- [ ] Tenant id required and validated; no unscoped queries.
- [ ] No write executes without an explicit confirm.
- [ ] Stale/ambiguous entities never execute.
- [ ] Undo is compensating and time-boxed; cancelled/refunded actions are out of scope.
- [ ] Secrets (M-Pesa passkey, tokens) are never in tool inputs/outputs or logs.
- [ ] Audio is not stored or logged; size/type limits enforced.
- [ ] Every confirmed/undone action is audited.
- [ ] Eval suite updated when adding a tool.
