# Menu Moja — Dashboard Information Architecture

> **Status:** Implemented (2026-11-15).
> **Goal:** 18 sidebar tabs → 8 sensible hubs, without rewriting the existing pages.

---

## 1. The 8 tabs

| Tab | Sub-tabs | Existing pieces |
|---|---|---|
| **Overview** | — | DashboardHome + “Ask AI” daily briefing button |
| **Operations** | Orders · Tables · Reservations · Cameras* | OrdersPage, TablesPage, ReservationsPage, SurveillancePage |
| **Menu** | Items · Promotions | MenuManager, PromotionsPage |
| **Inventory & Costs** | Stock · Recipes & Costing | InventoryPage, RecipesPage |
| **Customers** | Customers · Loyalty · Campaigns | CustomersPage, LoyaltyPage, WhatsAppPage |
| **Finance** | — | PaymentsPage (receipts, shifts, reconciliation) |
| **Insights** | Analytics · Profitability | AnalyticsPage, ProfitabilityPage |
| **Settings** | Profile, Appearance, QR, Staff, Payments, Notifications, Language, AI Assistant, AI Usage, Subscription, Danger | SettingsPage |

\* Cameras is hidden unless the restaurant’s plan has `hasSurveillance`.

**Help** was removed from the sidebar; it lives behind the `?` button in the top bar.

---

## 2. Legacy URLs

Old deep links redirect to the hub sub-tab, so bookmarks and existing `navigate()`
calls keep working:

| Old | New |
|---|---|
| `/dashboard/orders` | `/dashboard/operations?tab=orders` |
| `/dashboard/tables` | `/dashboard/operations?tab=tables` |
| `/dashboard/reservations` | `/dashboard/operations?tab=reservations` |
| `/dashboard/surveillance` | `/dashboard/operations?tab=cameras` |
| `/dashboard/promotions` | `/dashboard/menu?tab=promotions` |
| `/dashboard/recipes` | `/dashboard/inventory?tab=recipes` |
| `/dashboard/loyalty` | `/dashboard/customers?tab=loyalty` |
| `/dashboard/whatsapp` | `/dashboard/customers?tab=campaigns` |
| `/dashboard/analytics` | `/dashboard/insights?tab=analytics` |
| `/dashboard/profitability` | `/dashboard/insights?tab=profitability` |
| `/dashboard/payments` | `/dashboard/finance` |
| `/dashboard/ai-manager` | `/dashboard` (removed) |

The hub reads/writes `?tab=`, so sub-tabs are deep-linkable and browser
back/forward works.

---

## 3. AI Manager folded into the assistant

- The **AI Manager tab, route, page and frontend API functions are removed.**
- The old backend `/ai/manager/*` routes were removed as they are no longer
  used. The `ai-manager.service` / `ai-action.service` modules remain for
  `generateDailyBriefing` (used by the `get_daily_briefing` tool).
- What moved where:
  - Daily briefing → the assistant’s `get_daily_briefing` card + **Ask AI** on
    Overview.
  - Chat → the assistant (27 tools, progressive refinement, knowledge, voice).
  - Proposed actions → proposal/plan cards + **global pending approvals** in
    the assistant header.
  - Suggested questions → assistant suggestions.
- The assistant is named **`<Restaurant name> AI`** (e.g. “Amorino Restaurant
  AI”). The pill shows “AI”; the panel header/welcome use the full name.
- The panel is **draggable by its header** and constrained to the viewport.
- The chat session persists across dashboard tab switches and reloads
  (restaurant-scoped; cleared on logout; “New chat” resets it).

### Opt-out

Settings → **AI Assistant** toggles `RestaurantSettings.aiAssistantEnabled`.
- When off, the floating assistant is hidden and `POST /ai/command` +
  transcription return **403 `AI_ASSISTANT_DISABLED`**.
- The setting is per restaurant and can be re-enabled anytime.
- The default is on.

---

## 4. Implementation notes

- Hub pages (`src/pages/dashboard/hubs/`) reuse the existing page components
  unchanged; there is no page rewrite.
- `DashboardHub` renders only the active sub-tab.
- The sidebar has 8 `NavLink`s; active state is path-based.
- Cameras visibility is based on `restaurant.plan.hasSurveillance`.
- Build/tests: full backend suite + frontend build/lint after the refactor.
