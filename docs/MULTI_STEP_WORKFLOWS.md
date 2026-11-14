# Menu Moja — Multi-Step Plans (Phase D)

> **Status:** Implemented. Admin-only, confirm-everything.
> **Last updated:** 2026-11-12.
> **Related:** `docs/AI_COMMAND_LAYER.md`, `backend/src/ai/command.service.ts`.

---

## 1. What it does

A single instruction can be planned as **multiple write operations**, for
example:

> "86 the grilled tilapia and set chicken curry to 950"

Jarvis returns a **plan** (not a proposal): an ordered list of steps, each with
a human summary and risk. Nothing executes until the admin presses
**Confirm plan**.

There is **no autopilot** in this phase. The safety policy from Phase A still
applies: every write requires an explicit human confirmation.

---

## 2. How it works

1. The planner (`selectCommandPlan`) may return **1–N** tool calls
   (`AI_COMMAND_MAX_STEPS`, default 4, hard cap 6).
2. If it returns one tool, the Phase A/B behavior is unchanged (read answer or
   single proposal).
3. If it returns more than one tool:
   - every step is validated and **entity-resolved before anything is created**;
   - if any step is ambiguous or invalid, the whole request becomes a
     clarification and **no partial plan is created**;
   - multi-step plans are **write-only** (read reports should be requested
     separately);
   - one `AiAction` row is created per step, all `PENDING`, sharing a
     `workflowId`, `stepOrder` and `workflowTitle`.
4. The response is:
   ```json
   {
     "kind": "plan",
     "reply": "I can do these 2 steps in order: ...",
     "plan": { "id": "<workflowId>", "title": "...", "steps": [ ... ] },
     "toolUsed": "plan",
     "conversationId": "..."
   }
   ```

---

## 3. Confirming a plan

`POST /api/v1/ai/command/workflows/:id/confirm`

- Steps execute **in order**.
- Each step is re-resolved at execution time (stale entities fail safely).
- On the first failure, the failed step is marked `FAILED`, the workflow stops,
  and every remaining `PENDING` step is marked `SKIPPED`. Nothing else runs.
- Response:
  ```json
  {
    "workflowId": "...",
    "status": "COMPLETED" | "PARTIAL" | "FAILED",
    "steps": [
      { "actionId": "...", "tool": "...", "summary": "...", "status": "EXECUTED", "message": "...", "undoUntil": "..." }
    ]
  }
  ```

Re-confirming a partially executed plan will resume the remaining `PENDING`
steps (already executed/skipped steps are reported, not re-run).

---

## 4. Cancelling and undoing

- `POST /command/workflows/:id/cancel` — marks all `PENDING` steps `SKIPPED`.
- `POST /command/workflows/:id/undo` — compensates **executed** steps in
  **reverse order**, each using its own before-snapshot and undo window. Steps
  whose window has expired are reported as failed; the rest are still undone.
  The workflow status becomes `UNDONE` or `PARTIAL`.
- `GET /command/workflows/:id` — plan title, steps and statuses.

Individual steps remain undoable through the existing
`POST /command/:actionId/undo` endpoint.

---

## 5. Language-aware replies

The command request accepts an optional `language` (`"en"` or `"sw"`). The
planner and grounded-answer prompts instruct the model to reply in that
language. Tool summaries stay in English (structured data), while the
conversational reply follows the operator's language.

The command bar sends the current i18n language automatically.

---

## 6. Data model

No new table. `AiAction` gained:

| Field | Purpose |
|---|---|
| `workflowId` | Groups steps from one command. |
| `stepOrder` | Execution order (0-based). |
| `workflowTitle` | Human label for the plan. |
| `status = SKIPPED` | A step that was not run because an earlier step failed or the plan was cancelled. |

Migration: `backend/prisma/migrations/20261112040000_ai_workflows/`.

---

## 7. Safety invariants

- Admin-only (Phase B access policy still applies).
- Strict request body; role/tenant from JWT only.
- All-or-nothing at **proposal** time (no partial plans).
- Sequential execution with per-step re-resolution.
- Stop on first failure; never continue a broken chain.
- No auto-run, no autopilot rules.
- Every executed/undone step is audited.
- Undo is compensating, time-boxed, and reverse-order.

---

## 8. Tests

```bash
cd backend && npx jest tests/ai-command.test.ts
```

Covers: plan creation (multi-step, no execution), all-or-nothing clarification,
ordered execution, failure → skip remaining, cancel, reverse-order undo.

---

## 9. Deferred

- **Autopilot rules** — intentionally not implemented; conflicts with the
  no-auto-run policy. Could be revisited as “suggest-only” rules.
- Mixed read+write plans (e.g. "close the shift and send the report") — ask for
  the read separately for now.
- Parallel step execution — deliberately sequential for predictability.
- A dedicated workflow history screen (currently exposed via API + chat card).
