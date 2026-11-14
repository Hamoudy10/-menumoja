# Menu Moja — How Jarvis Knows the System (Phase E1)

> **Status:** Phase E1 implemented.
> **Related:** `docs/AI_COMMAND_LAYER.md`, `backend/src/ai/tools/`.

---

## 1. The principle

“Whole-system knowledge” is **not** a database dump or the full Prisma schema in
a prompt. It is a combination of:

| Layer | Mechanism | Why |
|---|---|---|
| Live business data | **Tools** (tenant-scoped queries) | Fresh, authorized, no hallucinated numbers |
| Routing knowledge | **System map** in the planner prompt | The model knows which domain/tool to use |
| Definitions | **Glossary** in the planner prompt | Consistent revenue/AOV/margin/open-order meanings |
| Product knowledge | **RAG** — `search_knowledge` (lexical FTS + citations) | Too large for a prompt; changes rarely |
| Context | JWT role/tenant + `uiContext` | Correct scope and screen awareness |
| Memory | `AiConversation` history | Follow-ups and clarifications |
| Quality | **Evals** (86+ prompts) + feedback | Catches routing regressions |

The model never sees the database directly and never executes SQL.

---

## 2. Current read coverage (19 read tools)

| Domain | Tool | What it answers |
|---|---|---|
| Sales | `get_sales_summary` | Revenue, orders, AOV, comparison |
| Menu | `get_top_items` | Best sellers |
| Menu | `get_menu_items` | Full menu list, category/availability/search |
| Inventory | `get_low_stock` | Low/out-of-stock items |
| Floor | `get_table_status` | Table states + active orders |
| Orders | `get_open_orders` | Active queue + wait times |
| Orders | `get_order_history` | Past orders by period/status/search |
| Payments | `get_payments_summary` | M-Pesa/cash/card totals, recent payments |
| Customers | `get_customers` | Spend, visits, segments (VIP, frequent, dormant…) |
| Recipes | `get_recipe_costs` | Cost, price, margin |
| Reservations | `get_reservations` | Bookings by period/status |
| Promotions | `get_promotions` | Active/scheduled specials/offers/events |
| QR | `get_qr_stats` | Scan totals and top codes |
| Billing | `get_subscription` | Plan, status, usage, unpaid invoices |
| Staff | `get_staff_performance` | Orders per waiter, collections per cashier |
| Staff | `get_staff_shifts` | Who is on shift |
| Analytics | `get_profitability` | Net sales, COGS, contribution, margin |
| Briefing | `get_daily_briefing` | Deterministic yesterday briefing |
| Settings | `get_settings` | Non-secret payment/tax/language settings |
| Help | `search_knowledge` | Product docs + restaurant FAQs, with citations |

Write tools (7): availability, special, price, restock, order status, assign
waiter, transfer table. All still require explicit confirmation.

---

## 3. Multi-domain questions

The planner may return several read tools for one instruction. The command
service executes them **together** and returns one grounded answer plus a list of
structured results (rendered as separate cards):

> “Show sales and low stock” → `get_sales_summary` + `get_low_stock`

Mixed read+write requests ask the operator to split the report from the change,
so a report is never bundled into a mutation plan.

---

## 4. System map & glossary

The planner prompt includes a compact system map (domains and capabilities) and
a glossary:

- Revenue = PAID, non-cancelled order totals.
- AOV = revenue / paid orders.
- Margin = (price − recipe cost) / price.
- Open order = PENDING/CONFIRMED/PREPARING/READY.
- Low stock = current stock < reorder level.
- Paid = payment status PAID.

This keeps answers consistent across tools and reduces “plausible but wrong”
numbers.

---

## 5. Security invariants

- Role/tenant come from the JWT only; request bodies are strict.
- All tools are tenant-scoped by `ctx.restaurantId`.
- AI commands are admin-only (`owner` + `super_admin` by default).
- Read tools never expose secrets (`get_settings` excludes the M-Pesa passkey).
- No auto-run; writes are proposed and confirmed.
- Confirmation re-resolves entities; stale proposals fail safely.

---

## 6. Adding a new read tool (checklist)

1. Add the tool to `backend/src/ai/tools/read.tools.ts` or
   `read-domain.tools.ts`.
2. Define `inputSchema` (zod) and `jsonSchema` (for function calling).
3. Implement `resolve` (validate/tenant-scope) and `run` (query).
4. Add an optional `summarize(data)` for a concise, deterministic reply.
5. Add a card in `src/components/ai/DataSummary.tsx`.
6. Add 2–3 prompts to `backend/tests/evals/command-prompts.ts` and the tool key
   to `EXPECTED_TOOL_KEYS`.
7. Run:
   ```bash
   cd backend && npx jest tests/ai-command.test.ts
   RUN_LIVE_AI_EVALS=1 npx jest tests/ai-evals.test.ts
   ```
8. Update this document and the tool catalog.

---

## 7. E2/E3 status and next steps

- **E2 — Product knowledge RAG: ✅ implemented.** Lexical retrieval over
  curated `docs/` + restaurant FAQs, with citations. See `docs/KNOWLEDGE_BASE.md`.
  (pgvector embeddings can be added later as a hybrid ranker.)
- **E3 — Learning loop: ✅ implemented.** 👍/👎 feedback from the command panel,
  tenant-scoped feedback storage, and a super-admin feedback list.
- **E4 — Polish (next):** suggested follow-ups, richer cards, optional manager
  access, and a “most failed questions” report from feedback.
- **Cost control:** the tool list is now 27; if prompt cost grows, add a cheap
  domain pre-filter before function calling.
