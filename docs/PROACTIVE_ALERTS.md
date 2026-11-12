# Menu Moja — Deterministic Proactive Alerts (Phase C)

> **Status:** Implemented. Backend detectors + scheduler + actionable admin UI.
> **Last updated:** 2026-11-12.
> **Related:** `docs/AI_COMMAND_LAYER.md` (Jarvis), `backend/src/services/proactive.service.ts`.

---

## 1. Purpose and principle

Jarvis should not wait to be asked. Phase C adds **proactive nudges** that help
the admin catch problems early:

- stock about to run out,
- orders waiting too long,
- a subscription about to expire,
- a daily briefing each morning.

**Hard rule: no LLM in the background.** Every detector is a plain,
tenant-scoped SQL query and costs nothing per run. The LLM is reserved for the
interactive command bar. The daily briefing is also deterministic (the existing
`generateDailyBriefing` insight engine), not a background AI call.

---

## 2. Detectors

| Detector | Type | Trigger | Dedupe window |
|---|---|---|---|
| Low stock | `LOW_STOCK` | Active inventory items below reorder level | 6 hours |
| Waiting orders | `ORDER_WAITING` | `PENDING`/`CONFIRMED`/`PREPARING` orders older than 20 min | 20 minutes |
| Subscription expiry | `SUBSCRIPTION_EXPIRING` | Trial or paid plan ending within 3 days | 24 hours |
| Daily briefing | `DAILY_BRIEFING` | First run after 07:00 local, once/day | Once per calendar day |

Dedupe is time-window based: before creating an alert, the service checks for an
existing `Notification` of the same type for that restaurant inside the window.
No schema change was required for dedupe.

---

## 3. Notification payload with pre-wired actions

Every nudge is persisted as a `Notification` row (`recipientType = OWNER`) and
emitted over Socket.io. The `data` JSON includes optional actions:

```json
{
  "kind": "low_stock",
  "items": [{ "name": "Tilapia", "stock": 3, "unit": "kg", "reorderLevel": 5 }],
  "actions": [
    { "kind": "command", "label": "Review with Jarvis", "text": "Show me what stock is low" },
    { "kind": "navigate", "label": "Open inventory", "to": "/dashboard/inventory" }
  ]
}
```

Action kinds:
- **`navigate`** — the notification bell routes the admin to an in-app page.
- **`command`** — the bell dispatches a `jarvis:command` event; the command bar
  opens and sends the text through the normal propose/confirm pipeline.

This means a nudge can never perform a write by itself; command actions still
require confirmation.

---

## 4. Scheduler

`backend/src/jobs/proactiveScheduler.ts` runs in-process (no Redis needed):

- first run ~90 seconds after boot,
- then every 5 minutes,
- `unref()` so it never keeps the process alive,
- disabled in tests and via env.

It is started from `backend/src/index.ts` only when `NODE_ENV !== 'test'`.

Admins can also trigger a run manually:

```
POST /api/v1/admin/proactive/run   (SUPER_ADMIN)
```

Response: `{ restaurants, lowStock, waitingOrders, expiringSubscriptions, dailyBriefings }`.

---

## 5. Frontend behavior

`src/components/notifications/NotificationBell.tsx`:

- Renders icons/colors for `LOW_STOCK`, `ORDER_WAITING`,
  `SUBSCRIPTION_EXPIRING`, `DAILY_BRIEFING` (and legacy types).
- Renders `data.actions` as buttons.
  - `navigate` → closes the bell and routes.
  - `command` → closes the bell and fires `window` event `jarvis:command`.
- Marks the notification read when an action is used.

`src/components/ai/JarvisCommandBar.tsx` listens for `jarvis:command`, opens the
panel, and sends the text as a normal command.

The unread badge was also fixed to compute from the returned list
(`isRead ?? read`), so new nudges are visible immediately via the existing 30s
poll.

---

## 6. Configuration

| Env var | Default | Meaning |
|---|---|---|
| `PROACTIVE_ALERTS_ENABLED` | `true` | Set `false` to disable the scheduler |
| `PROACTIVE_INTERVAL_MS` | `300000` | Scheduler cadence (5 min) |
| `PROACTIVE_WAITING_ORDER_MINUTES` | `20` | "Order waiting too long" threshold |
| `PROACTIVE_LOW_STOCK_DEDUPE_HOURS` | `6` | Low-stock repeat window |
| `PROACTIVE_WAITING_DEDUPE_MINUTES` | `20` | Waiting-order repeat window |
| `PROACTIVE_EXPIRY_WINDOW_DAYS` | `3` | Subscription "ending soon" window |
| `PROACTIVE_BRIEFING_HOUR` | `7` | Earliest local hour for the daily briefing |
| `PROACTIVE_MAX_RESTAURANTS` | `500` | Safety cap per sweep |

---

## 7. Migration

The new notification types are added by:

```
backend/prisma/migrations/20261112030000_proactive_notifications/
```

Apply all pending migrations with:

```bash
cd backend && npx prisma migrate deploy
```

Also required (created earlier): the billing and AI-command migrations.

---

## 8. Tests

```bash
cd backend && npx jest tests/proactive.test.ts
```

Covered:
- low-stock alert creation + action payload,
- dedupe suppression,
- waiting-order alert + no-op when none,
- subscription-expiry window logic,
- daily briefing hour gate and one-per-day behavior,
- full sweep counts (`runProactiveChecks`).

No LLM is mocked for these tests because the service never calls one.

---

## 9. Limitations / next steps

- Runs sequentially per restaurant (capped at 500). For very large fleets, move
  to a queue/worker or batch the queries.
- Dedupe is time-window based, not per-entity. A second genuinely new low-stock
  item within the window will not create a second alert; the next sweep after
  the window will.
- The daily briefing uses the deterministic insight engine (no narrative LLM
  call) to honour the "no background token burn" rule.
- Future: per-entity dedupe keys, WhatsApp/SMS delivery for critical alerts, and
  an "alerts" settings panel to let owners choose which nudges they receive.
