# MENU MOJA — GAP ANALYSIS (PHASE 0)

> **Inputs:** `docs/MENU_MOJA_AUDIT.md` (full feature matrix + A–Z audit), master plan parts 4–45.
> **Purpose:** Map the current product state to the target architecture (Operations / Intelligence / Growth / Connect), prioritize gaps, and define the recommended execution order with dependencies, effort, and risks.
> **Rule applied throughout:** reliability first, AI last; no rebuilds of working features; migrations for all schema change.

---

## 1. STRATEGIC GAP MAP (Current → Target)

```
TARGET DOMAIN                    CURRENT STATE                        GAP CLASS
─────────────────────────────────────────────────────────────────────────────────
1. MENU MOJA OPERATIONS          Strong (QR, ordering, POS, KDS,     HARDENING
   POS / KDS / Tables / Waiters     tables, staff, payments-cash)
   / Cashiers / QR / Payments     Weak: receipts, idempotency,
   / Receipts / Staff / Shifts       split payments, offline
─────────────────────────────────────────────────────────────────────────────────
2. MENU MOJA INTELLIGENCE         None                               BUILD (new domains)
   Inventory / Recipes / Costing
   / Profitability / Waste
   / Forecasting / AI manager
─────────────────────────────────────────────────────────────────────────────────
3. MENU MOJA GROWTH               None (analytics only)              BUILD (new domains)
   CRM / Loyalty / Promotions
   / Segmentation / WhatsApp
   / Re-engagement
─────────────────────────────────────────────────────────────────────────────────
4. MENU MOJA CONNECT              M-Pesa ✔, SMS ✔, USSD ⚠,          EXTEND
   M-Pesa / eTIMS / SMS / USSD      WhatsApp ✖ (dead code),
   / WhatsApp / APIs / Webhooks     eTIMS ✖, webhooks ✖
─────────────────────────────────────────────────────────────────────────────────
0. PLATFORM FOUNDATION            Migrations ✖, CI ✖,               FIX FIRST
   (multi-tenant SaaS reliability) audit persistence ⚠, admin MOCK,
   billing ⚠, observability ⚠, security tests ✖
```

---

## 2. FOUNDATION GAPS (fix before/alongside feature work)

| # | Gap | Evidence | Impact if unfixed | Fix |
|---|---|---|---|---|
| F1 | **No Prisma migrations**; prod startup uses `prisma db push --accept-data-loss` | `backend/scripts/start.sh`; no `prisma/migrations/` | Any schema change can destroy production data; blocks every new domain (inventory, CRM…) | Create baseline migration from current schema; switch start.sh to `prisma migrate deploy`; make migration part of CI; never `--accept-data-loss` in prod |
| F2 | **No CI pipeline** | No `.github/workflows` except keep-awake | Regressions ship silently | GitHub Actions: lint + typecheck + jest on PR; build check |
| F3 | **POS order idempotency missing** | `POST /orders` in `orders.routes.ts` has no dedup (public endpoint has 60s guard; POS none) | Duplicate orders on double-click/retry/refresh | Idempotency key header (`Idempotency-Key`) + DB constraint; client generates key per cart session |
| F4 | **Receipts not server-authoritative** | `genReceiptNo()` in `CashierDashboard.tsx` (client-side serial); no receipt table/API | KRA compliance risk; receipts lost on device | Central receipt service: Receipt model, server serials, print endpoint, PDF/thermal rendering; then eTIMS layer (phase 18) |
| F5 | **Audit trail not persisted** | `audit.ts` writes Winston only; no AuditLog model | No way to investigate disputes/security | `AuditLog` model + write-through from `auditLog` middleware; retention policy |
| F6 | **BullMQ workers are stubs** | `jobs/workers.ts` log-only | Queues useless for notifications/forecasting/exports | Implement real processors; add job observability |
| F7 | **Admin frontend mock** | `src/pages/admin/*` hardcoded | Platform cannot be operated | Wire admin UI to the existing (real) `/admin` API; add missing endpoints (audit log viewer, feature flags, webhooks) |
| F8 | **Plan limits unenforced; pricing hard-coded** | `SettingsPage` hardcodes KES prices; no limit checks on item/table creation | Revenue leakage; confusing pricing | Server-side plan enforcement (maxMenuItems/maxTables/subscriptionStatus gate on write ops); central billing config endpoint; remove hard-coded prices |
| F9 | **No cross-tenant / security tests** | `backend/tests/*` cover happy paths only | Tenant isolation unproven | Add security test suite (cross-tenant GET/POST, role escalation, invalid tokens, malicious payloads, webhook retry) |
| F10 | **No staging environment** | Deployment configs prod-only | Untested changes reach production | Render staging service + vercel preview; CI deploy hooks |

**Recommendation:** F1–F5 are prerequisites for every subsequent phase and should be executed as the first work package (Phase 1 in §6).

---

## 3. GAP ANALYSIS BY MASTER-PLAN PHASE

### PHASE 1 — Production Reliability (POS/KDS/Tables/Receipts/Auth)
| Gap | Current | Target | Effort |
|---|---|---|---|
| POS idempotency (F3) | none | Idempotency-Key + DB constraint + client key per cart | M |
| POS modifiers / add-ons | none (no model/UI) | ModifierGroup/ModifierOption models + POS + QR menu + KDS display | L |
| Split & partial payments | SPLIT/PARTIAL enums unused | Payment allocation model (allocation amounts per method); UI in POS | L |
| Held orders | modal-only, lost on refresh | persisted HeldOrder or order.status=ON_HOLD | S |
| KDS: reprint/cancel/void/sound | absent | KDS actions + config (sound toggle); order notes display | M |
| KDS station routing | single screen | optional station filter (config) | M |
| KDS sockets w/ polling fallback | polling only | Socket.io subscription + fallback polling + reconnect indicator | M |
| Table merge/split + cleaning status | absent | TableSession merge/split ops; CLEANING status | M |
| Receipt central service (F4) | client-side | Receipt model + API + thermal/PDF + reprint + refund receipts | L |
| Waiter order-idempotency + conflict prevention | none | optimistic locking on table status updates (version field) | S |

### PHASE 2 — M-Pesa & Payment Reliability
| Gap | Current | Target | Effort |
|---|---|---|---|
| Payment state machine | implicit statuses | PaymentTransaction state machine: CREATED→INITIATED→PENDING→SUCCESS→RECONCILED; FAILED/CANCELLED/EXPIRED/REVERSED/UNKNOWN | L |
| PaymentAttempt + webhook event log | none | PaymentAttempt, PaymentWebhookEvent (raw + parsed, idempotency, timestamps) | M |
| Reconciliation records + dashboard | cash shift only | ReconciliationRecord; admin/owner dashboard: expected, received, difference, unmatched, duplicate, failed, reversed | L |
| Timeout/cancellation/duplicate/amount-mismatch handling | partial (5-min dup block) | timed jobs, amount validation against order total, cross-order duplicate detection | M |
| Reversal/expiry flows | none | handle REVERSED callback + expire pending pushes | M |
| Payment observability | checkoutRequestId logs | correlation IDs across callback→payment→SMS/email; metrics | S |
| **Server-side confirmation authority** | already correct | keep + document; add tests proving frontend cannot mark paid | S |

### PHASE 3 — Offline-First Operations
| Gap | Current | Target | Effort |
|---|---|---|---|
| Local persistence + queues | none | IndexedDB (or localStorage for small data): menu cache, table state, order queue, sync queue, failed queue | L |
| Connectivity UI | none | ONLINE/OFFLINE/SYNCING/SYNC ERROR indicator (POS/KDS/waiter) | S |
| Idempotent sync | (see F3) | client idempotency keys reused by server | M |
| Conflict resolution | none | last-write-wins w/ server authority for statuses; detect stale table sessions | M |
| Offline tests | none | offline order → reconnect → dedup sync → no data loss; browser refresh; server restart | M |
| PWA enablement | disabled deliberately | decide: enable minimal PWA (cache shell) OR keep SPA; required for real offline | M |

### PHASE 4 — Inventory Foundation
| Gap | Current | Target | Effort |
|---|---|---|---|
| All models | none | Ingredient, InventoryItem, InventoryLocation, StockBatch, StockMovement (immutable), Supplier, PurchaseOrder(+Item), StockAdjustment, WasteRecord | L |
| Movement types | none | stock-in/out, waste, adjustment, transfer, purchase; **no silent overwrites — only movement history** | M |
| Units + conversion | none | unit of measure + conversion factors | M |
| Reorder levels + batch/expiry | none | min/max/reorder; expiry tracking | M |
| Auditability | none | every movement: user, timestamp, reason, reference (order/receipt) | M |
| API + UI | none | inventory pages (list, movements, suppliers, POs, adjustments) | L |

### PHASE 5 — Recipes & Food Costing
| Gap | Current | Target | Effort |
|---|---|---|---|
| Recipe model + versions | none | Recipe, RecipeIngredient (qty/unit), MenuItemCost; versioning preserves historical costs | M |
| Cost calculation | none | ingredient + packaging + attributable costs; contribution = price − cost; margin % | M |
| Cost-of-goods on orders | none | snapshot item cost at order time (historical accuracy) | M |
| API + UI | none | recipe editor, cost breakdown per item | M |

### PHASE 6 — Profitability Engine
| Gap | Current | Target | Effort |
|---|---|---|---|
| Profitability dashboard | revenue-only | revenue, discounts, refunds, net sales, COGS (from recipes), contribution, margin, AOV, units | L |
| Menu engineering (BCG) | none | STAR/PLOW HORSE/PUZZLE/DOG from popularity × margin; recommendations (promote/reprice/bundle/remove) | M |
| Scheduled aggregation | on-demand queries | daily profitability aggregates (analytics_daily extension) | M |

### PHASE 7 — Customer CRM
| Gap | Current | Target | Effort |
|---|---|---|---|
| Customer model | name/phone snapshots on Order | Customer (consent, source, first/last visit, spend, favourites, channel) | L |
| Identity resolution | none | phone-based matching from orders/QR sessions/SMS/USSD (with consent) | M |
| Privacy | none | consent record, opt-out, deletion/export endpoints, access controls, marketing audit | M |
| Segmentation | none | VIP/Frequent/New/Dormant/High-spender/Lunch/Dinner/Weekend/Deal-sensitive/Category-loyal | M |

### PHASE 8 — Smart Loyalty
| Gap | Current | Target | Effort |
|---|---|---|---|
| Rule engine + rewards | none | rules (VISIT_COUNT, SPEND_THRESHOLD, ITEM_COUNT, CATEGORY_PURCHASE, INACTIVITY, BIRTHDAY, REFERRAL); rewards (FREE_ITEM, DISCOUNT, FIXED_AMOUNT, PERCENTAGE, POINTS, BUNDLE) | L |
| Abuse prevention | none | usage limits, eligibility windows, per-branch scope, audit log | M |
| Point ledger | none | immutable point transactions | M |

### PHASE 9 — WhatsApp / Engagement
| Gap | Current | Target | Effort |
|---|---|---|---|
| Activation of WhatsApp module | **dead code** (`whatsapp.ts` never imported) | wire into order/payment/receipt/ready/loyalty/promo flows; consent-gated | M |
| Campaign engine | none | Campaign, AudienceSegment, MessageTemplate, CampaignDelivery, CampaignEvent, CampaignConversion; track sent/failed/redeemed/revenue — only provider-supported metrics | L |
| Inbound WhatsApp ordering (optional) | none | webhook routing (integration exists) | M |

### PHASE 10 — AI Menu Assistant Hardening
| Gap | Current | Target | Effort |
|---|---|---|---|
| Hallucination prevention | prompt context + fallback only | **structured tool calling / retrieval**: get_menu_items(available/prices), get_promotions(), get_faq() — never freeform DB access | M |
| Cost/usage control | rate limit 30/min | per-restaurant daily budget, usage+cost tracking, response caching, prompt versioning | M |
| Strictness tests | none | tests: AI never invents price/allergen/availability | S |

### PHASE 11 — AI Restaurant Manager
| Gap | Current | Target | Effort |
|---|---|---|---|
| Tool-based assistant | none | Menu Moja AI Manager with structured tools: get_sales_summary, get_order_summary, get_top_items, get_profitability, get_inventory_risk, get_customer_segments, get_customer_retention, get_staff_metrics, get_campaign_results, get_forecast | L |
| Data isolation | none | tools respect restaurant scope; only relevant aggregates retrieved | M |
| Failure isolation | n/a | AI failure never blocks dashboards | S |

### PHASE 12 — AI Daily Briefing
| Gap | Current | Target | Effort |
|---|---|---|---|
| Daily briefing | none | scheduled job (per restaurant, configurable time): revenue, orders, AOV, vs comparable day, top seller, highest margin, warnings, opportunities, recommendations — each with source + reason | M |

### PHASE 13–14 — Forecasting
| Gap | Current | Target | Effort |
|---|---|---|---|
| Sales forecasting | none | only after sufficient history (e.g. 90 days): day/hour/holiday/seasonality/promo/branch; confidence intervals; never assert certainty | L |
| Inventory forecasting | (needs Phase 4) | consumption history + forecast demand + stock + open POs + lead time + reorder level → risk + suggested purchase; no auto-ordering without owner-configured rule | M |

### PHASE 15–16 — Upselling & Personalized Menu
| Gap | Current | Target | Effort |
|---|---|---|---|
| Combination analytics | none (MenuItemSuggestion table exists, unused) | basket analysis → "customers ordering X add Y 62% of the time"; apply in QR/POS/waiter/AI with suggestion caps | M |
| Personalized storefront | static catalogue | Most popular / Best value / Recommended / Complete your meal / New / Promotions / Chef's picks; consent + minimal data for anonymous | M |

### PHASE 17 — Reservations & Waitlist
| Gap | Current | Target | Effort |
|---|---|---|---|
| Reservations | none | Reservation, ReservationParty, WaitlistEntry, TableAssignment; booking, assignment, estimated wait, check-in, no-show, cancel, notifications (WhatsApp/SMS) | L |
| Table integration | TableSession exists | reservations reserve tables (RESERVED status exists) | M |

### PHASE 18 — eTIMS / Kenya Compliance
| Gap | Current | Target | Effort |
|---|---|---|---|
| eTIMS | none (kraPin/vatRegNo stored; client-side "ETR-style" receipts) | **dedicated project**: verify official KRA API; sandbox; auth; invoice submission; retry; response handling; reconciliation; audit trail. Never claim compliance from local success. Server-side receipt service is a prerequisite (F4) | XL |

### PHASE 19 — Admin Platform
| Gap | Current | Target | Effort |
|---|---|---|---|
| Real admin | backend real, frontend mock | wire UI to API (F7); add: branches, users, usage, feature flags, webhooks, incidents, audit-log viewer; remove all mock data | L |
| Support tickets | CAMERA_ALERT notifications abused as tickets | dedicated SupportTicket model | M |

### PHASE 20 — Billing & Subscriptions
| Gap | Current | Target | Effort |
|---|---|---|---|
| Plan value model | 3 flat plans | STARTER/OPERATIONS/GROWTH/INTELLIGENCE/ENTERPRISE; monthly/annual/trial/branch add-ons | M |
| Billing engine | none | subscription payments (M-Pesa STK recurring/c2b), renewal jobs, dunning, proration; central billing config (no hard-coded pricing) | L |
| Enforcement | none | server-side feature/limit gates (F8) | M |

### PHASES 21–25 — Security / Observability / Performance / Docs / Launch
| Gap | Current | Target | Effort |
|---|---|---|---|
| Security review + tests | good baseline (see audit §X) | CSRF decision, PII plan, upload hardening, secret rotation check, security test suite | M |
| Observability | partial | /health + /ready split, latency/error-rate metrics, payment/webhook/queue/AI failure metrics, FE Sentry, correlation IDs | M |
| Performance | OK baseline | index review, N+1 fixes (e.g. analytics per-item queries), cached aggregates, bundle audits | M |
| Documentation | `SYSTEM_OVERVIEW.md` + audit + gap analysis done | ARCHITECTURE, API, DATABASE, AUTHORIZATION, PAYMENTS, OFFLINE, INVENTORY, FOOD_COSTING, CRM, LOYALTY, AI, FORECASTING, WHATSAPP, ETIMS, SECURITY, OBSERVABILITY, TESTING, DEPLOYMENT, PRODUCT_ROADMAP | M |
| Launch prep | pilots undefined | 3 pilot restaurants, baseline metrics, case studies, onboarding checklist + training guides | — (business) |

---

## 4. PRIORITIZED EXECUTION ORDER (recommended)

### Tier 0 — FOUNDATION ✅ EXECUTED (2026-08-12)
1. ✅ Prisma baseline migration + `migrate deploy` in start.sh (F1) — **apply to live DB on next deploy**
2. ✅ CI pipeline: lint, typecheck, tests, build (F2)
3. ✅ POS order idempotency — Redis + DB unique constraint + client keys (F3)
4. ✅ Audit persistence — AuditLog model + middleware write-through + admin endpoint (F5)
5. ✅ Cross-tenant/security test suite — 20 tests (F9)
6. ✅ Central receipt service — Receipt model, server serials, auto-generation on cash/card/M-Pesa, detail endpoint, frontend wiring (F4)
7. ✅ Test infrastructure repaired (suite could not run at all) + lint baseline established (0 errors)

**Remaining follow-ups for Tier 0:** apply migrations to the live Supabase database on the next deployment; monitor that `prisma migrate deploy` succeeds in `start.sh`.

### Tier 1a — POS/KDS RELIABILITY ✅ EXECUTED (2026-08-12)
1. ✅ **Payment idempotency** — `Payment.idempotencyKey` + composite unique (migration 4); cash/card record + M-Pesa initiate replay on duplicate `Idempotency-Key` (Redis fast-path + DB fallback + P2002 race resolution); CashierDashboard generates a key per payment flow (reset on order change/success).
2. ✅ **Persisted held orders** — `Order.isHeld`; `PUT /orders/:id/hold` (rejects paid/preparing) + `/unhold`; live & kitchen queries exclude held; `GET /orders?held=true`; POS loads/releases held orders via API (survives refresh).
3. ✅ **KDS hardening** — cancel-with-reason (via existing cancel API), reprint ticket (72mm print window), new-order chime with sound toggle (localStorage `kds_sound`), online/offline + last-sync indicator.
4. ✅ **Table optimistic locking** — `RestaurantTable.version`; status/session/update endpoints reject stale versions with 409 `TABLE_CONFLICT`; store refetches tables on conflict.
5. ✅ Tests — `tests/reliability.test.ts` (7 tests): cash payment replay (single create), M-Pesa initiate replay, hold/unhold + rejection rules, table version match + stale 409.

**Remaining in Tier 1a:** split/partial payments (allocation model), modifiers/add-ons (DB + POS + QR + KDS), KDS station routing, table merge/split.

### Tier 1b — M-PESA STATE MACHINE ✅ EXECUTED (2026-08-12)
1. ✅ **Models (migration 5)** — `PaymentAttempt` (per STK push: INITIATED→PENDING→SUCCESS/FAILED/EXPIRED/CANCELLED/REVERSED/UNKNOWN, receipt + error codes), `PaymentWebhookEvent` (raw Safaricom callbacks, ipAddress, isDuplicate, processed), `ReconciliationRecord` (daily: expected/received/difference/unmatched/duplicate/failed/expired/reversed).
2. ✅ **Attempt lifecycle** — created on every STK push; SUCCESS/FAILED (1032 → CANCELLED) on callback; updated on status-query resolution.
3. ✅ **Webhook audit** — every callback persisted raw with duplicate flag + source IP; duplicates never reprocessed (Redis idempotency retained).
4. ✅ **Amount-mismatch guard** — settled amount ≠ requested → attempt FAILED `AMOUNT_MISMATCH`, payment NOT marked paid, bilingual SMS to customer.
5. ✅ **Stale expiry** — attempts still PENDING after 30 min marked EXPIRED (run during reconciliation).
6. ✅ **Reconciliation API + UI** — `POST /payments/reconciliation/run` (expire stale → compute → upsert), `GET /reconciliation/summary?date=`, `GET /reconciliation/history`; PaymentsPage shows Expected/Received/Difference/Unmatched + Duplicate/Failed/Expired/Reversed chips, Run button, history list.
7. ✅ Tests — `tests/reconciliation.test.ts` (6): attempt creation, webhook logging (new + duplicate), reconcile compute+persist, expiry, history.

**Remaining in Tier 1b:** REVERSED ingestion (Safaricom B2C/C2B reversal events — needs eTIMS-class API work), scheduled nightly reconciliation (blocked on real BullMQ workers), UNKNOWN-state handling.

### Tier 1c — OFFLINE-FIRST ✅ EXECUTED (2026-08-12)
1. ✅ **Offline mutation queue** (`src/utils/offline.ts`) — localStorage-backed ordered queue for POS order creation + cash/card payment recording; every mutation carries its own idempotency key (server-side dedupe makes replays safe); bounded attempts (5) then SYNC ERROR; storage adapter injected for testability.
2. ✅ **Sync layer** (`src/utils/offlineSync.ts`) — maps queued mutations to the real API calls with their keys.
3. ✅ **POS integration** — quick-order creation and cash/card payments fall back to the queue on network errors with optimistic local UI (temp order row / receipt with "PENDING SYNC" banner); auto-flush on reconnect and on mount; manual retry via the header pill.
4. ✅ **Status UI** — ONLINE (hidden) / OFFLINE / SYNCING / SYNC ERROR pill in the cashier header with pending count, click to retry. KDS already has its online/offline indicator (Tier 1a).
5. ✅ **Frontend test framework** — vitest added (`npm test`), CI step wired; 9 unit tests: ordered enqueue, idempotency-key dedupe, localStorage durability across instances, ordered flush, retry-on-failure, attempt bounding → sync_error, status transitions, clear, network-error detection.
6. ✅ No backend changes — the queue reuses existing endpoints + idempotency.

**Documented limitations:** menu cache + table state caching offline not yet persisted (menu loads need server — POS search uses store state, degrade gracefully offline); KDS is read-only offline (stale view + indicator); conflict resolution relies on server status machine + table version guards (422/409 land in the retry queue); M-Pesa requires connectivity (STK push is server-initiated).

### Tier 2 — INVENTORY FOUNDATION ✅ EXECUTED (2026-08-12)
1. ✅ **Models (migration 6)** — `InventoryItem` (unit, min/max stock, reorder level), `StockMovement` (immutable; signed quantity; type OPENING/PURCHASE/SALE/WASTE/ADJUSTMENT/TRANSFER; reference PURCHASE_ORDER/ORDER/MANUAL/OPENING; unit cost + total cost), `Supplier`, `PurchaseOrder` (DRAFT/ORDERED/PARTIAL/RECEIVED/CANCELLED) + `PurchaseOrderItem` (receivedQty).
2. ✅ **Immutability principle** — stock levels are NEVER overwritten: always the sum of movement rows. Consumption movements rejected when stock would go negative (409 INSUFFICIENT_STOCK) and when signed wrongly (422).
3. ✅ **Service** — `recordMovement` (validation + insufficient-stock guard), `getStockLevel(s)`, `getLowStockItems`, `receivePurchaseOrder` (creates PURCHASE movements per line, updates receivedQty + PARTIAL/RECEIVED status).
4. ✅ **API** (`/api/v1/inventory`) — items CRUD (delete blocked with movement history → 409), movements list (filters + pagination) + record, low-stock, suppliers CRUD (delete blocked with POs), purchase orders CRUD + receive. All tenant-scoped + audited writes.
5. ✅ **UI** — `/dashboard/inventory` page: Items (stock + low-stock badges, add/edit/delete), Movements (history + record modal), Suppliers (CRUD), Purchase Orders (create with line items + receive button). Sidebar + route wired.
6. ✅ Tests — `tests/inventory.test.ts` (9): item create, stock-level computation + low-stock flags, delete protection, movement recording, insufficient-stock rejection, sign validation, supplier CRUD, PO create + receive movement creation.

**Design choices (documented):** single `InventoryItem` entity (no separate Ingredient/InventoryLocation — single location per restaurant, batch/expiry deferred); WASTE/ADJUSTMENT recorded via StockMovement types (no separate tables); recipe-driven auto-deduction deferred to Phase 5.

### Tier 2b — RECIPES & FOOD COSTING ✅ EXECUTED (2026-08-12)
1. ✅ **Models (migration 7)** — `Recipe` (versioned per menu item, `@@unique([menuItemId, version])`, active flag) + `RecipeIngredient` with **`unitCostSnapshot`** captured at save time — ingredient cost changes never rewrite historical versions.
2. ✅ **Versioning** — create → v1; every edit saves vN+1 and deactivates the previous (history preserved, never deleted).
3. ✅ **Costing service** — `getItemCurrentCost` (most recent costed movement, purchases preferred), `getRecipeCost`, `getMenuItemCosting` (`cost = Σ(qty × snapshot)`, `contribution = price − cost`, `margin % = contribution/price × 100`), `getAllMenuItemCostings` (feeds the recipes UI and the upcoming menu-engineering engine).
4. ✅ **API** (`/api/v1/recipes`) — status (all items + costing), active recipe + versions, create (v1), update (new version), per-item costing, single version. Tenant-scoped + audited writes.
5. ✅ **UI** — `/dashboard/recipes`: item cards with price/cost/margin + contribution, active-recipe breakdown, version-preservation note, recipe editor (ingredient picker with current costs from inventory, quantity, live estimate). Sidebar + route wired. Inventory item list now includes `lastUnitCost`.
6. ✅ Tests — `tests/recipe.test.ts` (7): v1 creation with cost snapshots, v2 save preserving v1 (deactivation, not deletion), active-recipe conflict, costing math (375 cost / 625 contribution / 62.5% margin), no-recipe zero cost, status listing, tenant scoping.

**Remaining in Tier 2:** order-time COGS snapshotting + menu engineering (STAR/PLOW HORSE/PUZZLE/DOG) → Tier 2c.

### Tier 2c — PROFITABILITY & MENU ENGINEERING ✅ EXECUTED (2026-08-12)
1. ✅ **Profitability overview** — grossSales (Σ paid order totals), discounts (gross − Σ paid payments), refunds, netSales, **estimated COGS** (Σ order-item qty × current active recipe cost), contribution, margin %, order count, units sold, AOV. COGS explicitly labelled an estimate (order-time snapshots deferred to the COGS-on-orders phase).
2. ✅ **Menu engineering** — popularity (units sold) × profitability (margin %) split at the axis medians → **STAR / PLOW HORSE / PUZZLE / DOG**, each with a recommendation (promote/reprice/promote/remove-review). Items without recipes → **NO_COST_DATA** (never guessed). Unsold items don't skew the popularity median.
3. ✅ **API** — `GET /analytics/profitability/overview?period=` + `GET /analytics/profitability/menu-engineering?period=` (reuse analytics period/date helpers).
4. ✅ **UI** — `/dashboard/profitability`: period toggle, metric cards (gross/net/COGS/contribution), margin/orders/units/refunds tiles, and a 2×2 matrix with quadrant buckets, counts, and recommendations. Sidebar + route wired.
5. ✅ Tests — `tests/profitability.test.ts` (4): full overview math (2,500 gross / 100 discounts / 200 refunds / 2,200 net / 600 COGS / 72.7% margin), empty period, four-way classification with exact medians, NO_COST_DATA handling.

### Tier 3 — CUSTOMER CRM ✅ EXECUTED (2026-08-12)
1. ✅ **Model (migration 8)** — `Customer`: phone (unique per restaurant), name, email, source (QR/POS/SMS/USSD/MANUAL), **explicit marketing consent** (`consentMarketing` + `consentCollectedAt`), opt-out flag, preferredChannel, firstVisit/lastVisit/totalVisits, cached totalSpend/averageSpend.
2. ✅ **Identity resolution** — `upsertCustomer` dedupes by (restaurantId, phone) with P2002 race retry; hooked (best-effort, never breaks the primary flow) into: QR order creation, cash/card payment record, **M-Pesa callback success** (spend accrual via `recordCustomerSpend`). SMS/USSD sources ready for the same hook.
3. ✅ **Favourites + segments** — detail endpoint derives favourite items/categories from order history and classifies **VIP / Frequent / New / Dormant / High spender / Lunch / Dinner / Weekend / Category-loyal** (multi-label).
4. ✅ **Privacy** — `DELETE` anonymizes related order + payment PII then removes the customer; `GET /:id/export` returns everything stored; consent/opt-out editable per customer.
5. ✅ **API** (`/api/v1/customers`) — list (search + segment filter + segment counts), detail, update (consent), export, delete. Tenant-scoped, audited writes.
6. ✅ **UI** — `/dashboard/customers`: searchable list with spend/visits + segment chips, segment-count banner (click to filter), slide-in profile drawer (favourites, segments, recent orders, consent/opt-out/channel controls, JSON data export, privacy delete). Sidebar + route wired.
7. ✅ Tests — `tests/customer.test.ts` (6): list + segment counts, favourites/detail, consent update, privacy deletion (order/payment PII nulled), export, segment classification rules.

**Remaining in Tier 3:** backfill customers from historical orders (resumable migration job — see master plan §32), Deal-sensitive segment (needs per-order discount tracking), order-time COGS snapshots.

### Tier 3b — SMART LOYALTY ✅ EXECUTED (2026-08-12)
1. ✅ **Models (migration 9)** — `LoyaltyProgram` (points per KES, expiry days), `LoyaltyRule` (trigger/reward/date window/usage limit), `LoyaltyAccount` (balance + totals), `LoyaltyTransaction` (**immutable ledger**: EARN/REDEEM/ADJUST/EXPIRE with reason + reference), `LoyaltyReward` (ISSUED/REDEEMED/EXPIRED/CANCELLED). Customer gained `dateOfBirth` (birthday trigger).
2. ✅ **Points** — earned as `floor(spend ÷ points-per-KES)` on every confirmed payment (M-Pesa callback, cash, card); balance is always the ledger sum, never overwritten; redemption blocked if balance insufficient (409).
3. ✅ **Rule engine** — triggers VISIT_COUNT, SPEND_THRESHOLD, ITEM_COUNT, CATEGORY_PURCHASE, INACTIVITY, BIRTHDAY; rewards FREE_ITEM, DISCOUNT, FIXED_AMOUNT, PERCENTAGE, POINTS, BUNDLE. Rules are date-windowed + active-flagged.
4. ✅ **Abuse prevention** — per-customer usage limit per rule enforced at issue time; rewards single-use (double redemption → 409); redemption requires ISSUED + not expired.
5. ✅ **API** (`/api/v1/loyalty`) — program get/update, rules CRUD, accounts list/detail, audited manual point adjustments, rewards list/redeem/cancel. Tenant-scoped.
6. ✅ **UI** — `/dashboard/loyalty`: Program settings, Rules builder (trigger/reward pickers, item links), Accounts (balances, ledger, manual adjust, rewards) and Rewards (issue/redeem). Sidebar + route wired.
7. ✅ Tests — `tests/loyalty.test.ts` (9): points math + ledger row, insufficient-balance rejection, FREE_ITEM issue on rule match, usage-limit enforcement, ITEM_COUNT + CATEGORY_PURCHASE triggers, single redemption + double-redemption rejection.

**Deferred (documented):** REFERRAL trigger (needs referral-link infrastructure), points expiry job (needs real BullMQ workers), loyalty notifications (WhatsApp phase).

### Tier 3c — WHATSAPP / CUSTOMER ENGAGEMENT ✅ EXECUTED (2026-08-12)
1. ✅ **Activated the dormant WhatsApp integration** (`integrations/whatsapp.ts` was dead code) — now the send layer for a full engagement system.
2. ✅ **Models (migration 10)** — `WhatsAppSettings` (per-restaurant enable + business phone), `MessageTemplate` (placeholder templates), `Campaign` (segment/template/message/status/counters), `CampaignDelivery` (per-recipient PENDING/SENT/FAILED), `CampaignEvent` (conversion attribution).
3. ✅ **Consent gate (hard)** — NO message without `consentMarketing && !isOptedOut` and a compatible preferred channel; channel-level toggle; transactional confirmations gated the same way.
4. ✅ **Transactional flows** — order confirmation (on order create), payment receipt (cash/card/M-Pesa), order-ready (on READY transition). All best-effort, never break the primary flow.
5. ✅ **Campaigns** — audience built from consenting customers (+ segment filter via CRM classifier), template/custom message, per-recipient deliveries, SENT/FAILED only (no claimed delivery/open stats), idempotent (SENT campaigns can't re-send).
6. ✅ **Attribution** — paid orders from campaign-recipient customers within 7 days create CampaignEvent ORDER rows (revenue attributed per campaign).
7. ✅ **API** (`/api/v1/whatsapp`) — settings, templates CRUD, campaigns CRUD + send. Tenant-scoped, audited writes.
8. ✅ **UI** — `/dashboard/whatsapp`: settings (enable + number + consent/delivery notes), templates (placeholder editor), campaigns (segment picker, send, recipient/sent/failed counts). Sidebar + route wired.
9. ✅ Tests — `tests/whatsapp.test.ts` (11): template compilation, consent/opt-out/disabled gates, send with compiled content, channel preference, campaign delivery recording (SENT + FAILED), re-send rejection, 7-day conversion attribution.

**Documented:** delivery receipts/opens require Meta webhook wiring (not claimed); scheduled sends need real BullMQ workers; REFERRAL trigger still deferred.

### Tier 4a — AI MENU ASSISTANT HARDENING ✅ EXECUTED (2026-08-12)
1. ✅ **Usage tracking (migration 11)** — `AiUsageLog`: every LLM call logged with real token counts (surfaced from the OpenAI SDK response), provider/model, latency, prompt version, cached flag, and **estimated cost in KES** (DeepSeek/OpenAI price tables × USD→KES).
2. ✅ **Daily budget** — 200K tokens/restaurant/day; when exceeded, customer chat silently uses the rule-based chef fallback. **AI failure never affects operations.**
3. ✅ **Response caching** — customer-chat replies cached in Redis keyed by menu fingerprint + language + message (1h TTL). Repeated questions cost nothing; menu changes invalidate automatically via the fingerprint. Cache hits are logged as `cached: true`.
4. ✅ **Grounding enforcement** — the LLM prompt now explicitly forbids inventing prices/dietary/allergen facts, AND a post-processor verifies every "KES <amount>" in the reply against the served menu prices (±1 rounding). Failed replies are rejected and replaced with the rule-based chef. **The model can no longer invent prices.**
5. ✅ **Prompt versioning** — `PROMPT_VERSION` constant recorded on every usage row.
6. ✅ **Owner view** — `GET /ai/usage?period=` (requests/tokens/cost + per-feature breakdown + budget) and an **AI Usage card in Settings** with period toggle.
7. ✅ Tests — `tests/ai-usage.test.ts` (10): grounding pass/reject, token + KES estimation, cache round-trip, fingerprint stability, budget under/over, usage API + tenant scoping, usage-log shape.

**Remaining in Tier 4:** structured function-calling tools (current design = retrieval + grounding, which achieves the same no-hallucination guarantee more simply), AI Restaurant Manager + daily briefing (Tier 4b).

### Tier 4b — AI RESTAURANT MANAGER ✅ EXECUTED (2026-08-12)
1. ✅ **Structured tool layer** (`manager.service.ts`) — retrievals: sales summary (revenue/orders/AOV + previous-period comparison + top items), order summary (statuses/peak/dine-in vs takeaway), profitability snapshot, inventory risk (low/out of stock with reorder levels), customer segments + repeat rate, staff metrics (waiters served / cashiers collected), campaign results (sent/failed + attributed revenue), and a **naive sales forecast** (same-weekday average over 4 weeks with confidence High/Moderate/Low + low/high band). No tool ever dumps the database.
2. ✅ **Grounded answers** — intent detection (specificity-weighted keywords) maps the question to a tool; the LLM sees ONLY the tool output and is instructed to never invent numbers; replies + real token usage are logged via the AI usage system. Unknown intents cost nothing (helpful menu returned). Budget-exhausted or LLM-failed → structured data returned directly (**AI is never a dependency for operations**).
3. ✅ **Daily briefing** — deterministic: yesterday's revenue/orders/AOV, ±% vs same weekday last week, top seller, highest-margin best-seller, low-stock warnings, no-orders note. **Every insight carries a reason and a data source.**
4. ✅ **API** — `POST /ai/manager/ask`, `GET /ai/manager/briefing` (tenant-scoped, validated).
5. ✅ **UI** — `/dashboard/ai-manager`: briefing card grid + chat with suggested questions, source labels ("answered from structured data") and cost/reliability note. Sidebar + route wired.
6. ✅ Tests — `tests/manager.test.ts` (7): intent mapping incl. tie-breaking, unknown-intent no-LLM path, tool answer with data, briefing math (8.5% change, top seller, reasons+sources), forecast shape, ask + briefing API endpoints.

**Deferred (documented):** deeper forecasting (holidays/seasonality/promos) requires more history; LLM-phrased briefing polish optional; automated daily-briefing scheduling needs real BullMQ workers.

### Tier 4c — SMART UPSELLING & PERSONALIZED QR MENU ✅ EXECUTED (2026-08-12)
1. ✅ **Basket analysis** (`upsell.service.ts`) — "customers ordering Burger add Fries 62% of the time" computed from paid orders in the last 90 days; per-item co-occurrence stats with percentages; **cart-aware suggestions** that exclude existing cart items and unavailable items, capped (max 3–5).
2. ✅ **Personalized storefront** (`menu-personalization.service.ts`) — sections: Most Popular (by totalOrders), Best Value (highest-margin items with recipes), New, Promotions, **Recommended for You** (only from the session's OWN order history — anonymous sessions never get it), and **Complete your meal** (basket analysis on the provided cart). Privacy-respecting: aggregate-only for anonymous customers.
3. ✅ **Public API** — `GET /menu/public/:slug/upsells?itemIds=` (with `upsellPercentage` per item) and `GET /menu/public/:slug/personalized?sessionId=&cartItemIds=`. Tenant-scoped by slug.
4. ✅ **UI** — MenuCart shows a "Complete your meal" strip with one-tap add + percentages; MenuView shows Most Popular / Best Value / New horizontal strips with mini cards (add/qty steppers), session-id stored per restaurant.
5. ✅ Tests — `tests/upsell.test.ts` (5): co-occurrence percentages (60%/30%), cart-item + availability exclusion, anonymous (no recommendation), session-based recommendation, upsell API. (Also fixed cross-test Once-queue pollution with per-test resets.)

**Documented:** AI-assistant upsell wiring deferred (chat already suggests items); deeper personalization (consent-based preferences) gated behind the CRM consent model.

### Tier 5 — RESERVATIONS & WAITLIST (next recommended)
7. POS hardening: modifiers, split/partial payments, held orders (persisted), KDS station/actions, table merge/split, optimistic locking
8. M-Pesa: state machine, PaymentAttempt/WebhookEvent, reconciliation dashboard, timeout/reversal handling
9. Offline-first: local queues + sync + connectivity UI + PWA decision

### Tier 2 — FOUNDATIONS FOR INTELLIGENCE (phases 4–6)
10. Inventory (models, movements, suppliers, POs, adjustments, reorder)
11. Recipes + food costing (versioned)
12. Profitability + menu engineering

### Tier 3 — GROWTH (phases 7–9)
13. CRM (identity, consent, segmentation)
14. Loyalty rule engine
15. WhatsApp activation + campaigns

### Tier 4 — AI & ADVANCED (phases 10–18)
16. AI assistant hardening (tool calling, cost control)
17. AI Restaurant Manager + daily briefing
18. Forecasting (sales then inventory)
19. Upselling + personalized menu
20. Reservations/waitlist
21. eTIMS (only after F4 + Tier 2 data)

### Tier 5 — PLATFORM (phases 19–25)
22. Real admin platform + billing engine + plan enforcement
23. Security hardening pass, observability, performance, documentation, launch

**Hard dependencies:**
- eTIMS → receipt service (F4) + inventory/tax data (Tier 2)
- Inventory forecasting → inventory (Tier 2) + sales forecast (Tier 4)
- Profitability → recipes (Tier 2)
- Personalized menu → CRM segments (Tier 3)
- Offline sync → POS idempotency (Tier 0)
- Reconciliation dashboard → M-Pesa state machine (same phase)

---

## 5. KEY RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| `db push --accept-data-loss` continues → data loss during new phases | F1 first; freeze schema changes until baseline migration exists |
| Duplicate POS orders erode cashier trust | F3 idempotency + tests for double-click/refresh/retry |
| Client-side receipts create compliance exposure | F4 central receipt service before any eTIMS claim |
| AI features treated as done because "UI exists" | Apply Definition of Done checklist (master plan part 44) per phase |
| Marketing overclaims (offline claim, ETR receipts) | Audit-flagged claims corrected in copy + docs (landing assistant claim is false today) |
| Mock admin data seen as "feature" | F7 — wire to real API before pilots |
| Pilot restaurants harmed by unproven offline behavior | Offline phase + pilots: only run pilots after Tier 0–1 |
| Scope explosion | Work one approved phase at a time; every phase ends buildable + tested + documented |

---

## 6. RECOMMENDED NEXT ACTION

Execute **Tier 0 (Foundation)** as the single next work package, in this order:

1. **F1 — Baseline migration** (init prisma migrations from current schema, update `start.sh`, add to CI)
2. **F3 — POS idempotency** (Idempotency-Key header + DB uniqueness + client key + tests)
3. **F5 — Audit persistence** (AuditLog model + middleware write-through + retention)
4. **F2 — CI pipeline** (lint, typecheck, jest, build on PR)
5. **F9 — Security test suite** (cross-tenant, RBAC escalation, webhook retry)
6. **F4 — Receipt service** (Receipt model + server serials + print/PDF endpoints)

Each item: inspect → design (DB/API/UI) → implement → tests → lint/typecheck/build → docs → summary + known limitations.

*End of gap analysis. Continues from `docs/MENU_MOJA_AUDIT.md`.*
