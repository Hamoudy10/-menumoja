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

### Tier 1 — RELIABILITY (master plan phases 1–3)
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
