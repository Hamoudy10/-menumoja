# Customers & CRM

How MenuMoja decides who a customer is, what counts as a visit, how spend and
segments are derived, and how consent/privacy are enforced.

Code map:

| Concern | Location |
| --- | --- |
| Identity, visits, spend, segments, privacy | `backend/src/services/customer.service.ts` |
| Phone normalisation | `backend/src/utils/phone.ts` |
| CRM API | `backend/src/routes/customers/customers.routes.ts` |
| CRM UI | `src/pages/dashboard/CustomersPage.tsx` (`CustomersHub`) |
| Orders / POS writes | `backend/src/routes/orders/orders.routes.ts` |
| Payments & M-Pesa | `backend/src/routes/payments/payments.routes.ts`, `backend/src/services/mpesa.service.ts` |
| Reservations & waitlist | `backend/src/services/reservation.service.ts` |
| Loyalty | `backend/src/services/loyalty.service.ts` |
| WhatsApp / campaigns | `backend/src/services/whatsapp.service.ts` |

## 1. Identity

A customer is keyed by `(restaurantId, phone)` and `Customer.phone` stores a
**canonical Kenyan MSISDN**: `2547XXXXXXXX` or `2541XXXXXXXX` (12 digits, no
`+`, no spaces).

`normalizeKenyanPhone()` accepts every format the product receives and returns
the canonical form or `null` for non-Kenyan/invalid numbers:

| Input | Canonical |
| --- | --- |
| `0712345678` | `254712345678` |
| `0112345678` | `254112345678` |
| `+254712345678` | `254712345678` |
| `00254712345678` | `254712345678` |
| `712345678` | `254712345678` |
| `2540712345678` | `254712345678` |
| `0712 345 678` / `0712-345-678` | `254712345678` |

`phoneQueryVariants()` returns every representation we may have stored before
normalisation was centralised (`2547…`, `+2547…`, `07…`, `7…`, `002547…`,
`25407…`, plus the raw input). Reads use these variants so **legacy rows keep
working**, while every new write stores the canonical form.

`upsertCustomer()` normalises, then looks up exact-match first and falls back to
variant search. An invalid phone is logged and skipped — it never creates a
garbage customer and never blocks an order.

Call sites:

- QR/public order creation — `source: 'QR'`
- POS order creation — `source: 'POS'`
- Reservations and waitlist — `source: 'MANUAL'` / `'QR'`
- Payments / M-Pesa callbacks — touch-only (`source: 'QR'` / `'POS'`)

## 2. Visits

A **visit is a real interaction**, not a booking or a payment:

| Event | Counts a visit? |
| --- | --- |
| Public (QR) order created | Yes |
| POS order created | Yes |
| Reservation created | No (touches `lastVisit` only) |
| Reservation checked in | Yes |
| Waitlist entry added | No |
| Waitlist entry seated | Yes |
| Payment / M-Pesa confirmed | No (touches `lastVisit`, records spend) |

Visits are counted **at most once per Kenya calendar day** (EAT, UTC+3, no DST)
using `Customer.lastVisitCountedAt`. Three orders at one table on Saturday =
one visit; returning Sunday = a second visit. This keeps loyalty visit-count
rules and `averageSpend` honest.

Implementation detail: `upsertCustomer(..., { countVisit: true })` compares the
Kenya day key of `lastVisitCountedAt` to today and only then applies
`totalVisits = { increment: 1 }`. All other calls pass `countVisit: false`.

## 3. Spend and refunds

- `recordCustomerSpend()` runs when a payment is confirmed (cash/card route and
  the M-Pesa callback) and adds the paid amount to `totalSpend`, recalculating
  `averageSpend = totalSpend / totalVisits`.
- `reverseCustomerSpend()` runs when a paid order is cancelled or refunded, and
  clamps at zero. Cash/card reversals happen immediately; M-Pesa reversals run
  once the refund is initiated.
- Payment endpoints are idempotent, so retries do not double-count spend.
- M-Pesa refund state is explicit: `Payment.status = REFUNDED`,
  `refundConversationId`, `refundedAt`, and `Order.paymentStatus = REFUNDED`.
  Failed STK pushes set `Order.paymentStatus = UNPAID` (never an invalid order
  status).

## 4. Segments

`classifyCustomer()` is **multi-label** — a customer can be in several
segments. Counts on the Customers page and the segment filter are computed over
the **whole customer base**, not the current page.

Stat-based segments:

| Segment | Rule |
| --- | --- |
| VIP | `totalSpend >= 20,000` and `totalVisits >= 5` |
| Frequent | `totalVisits >= 5` |
| New | first visit within 30 days |
| Dormant | last visit more than 90 days ago |
| High spender | `totalSpend >= 10,000` |

Behaviour segments come from recent **paid or refunded** orders (last 180 days,
max 5,000 rows per restaurant):

| Segment | Rule |
| --- | --- |
| Lunch customer | ≥ 50% of orders between 11:00–15:59 EAT |
| Dinner customer | ≥ 50% of orders between 18:00–22:59 EAT |
| Weekend customer | ≥ 50% of orders on Fri/Sat/Sun |
| Category-loyal | ≥ 50% of units from one menu category |

Order behaviour is cached per restaurant for 60 seconds outside tests; customer
rows (and therefore consent/opt-out state) are always read live.

**Caveat:** because behaviour is bounded to a 180-day window and 5,000 orders,
time-of-day/category segments reflect *recent* behaviour, not lifetime history.
Stat-based segments use lifetime totals. Historical `totalVisits`/`totalSpend`
written before this change were not backfilled corrected; the migration only
sets `lastVisitCountedAt` from `lastVisit` so future counting is stable.

## 5. Consent and marketing

Two independent gates must both pass before any marketing/WhatsApp message:

1. `consentMarketing === true`
2. `isOptedOut === false`
3. `preferredChannel` is unset or `whatsapp`

`canContact()` is the single gate used by `sendTransactional()` and campaign
sends. Consent changes are recorded with `consentCollectedAt`; revoking consent
clears it. Campaign audiences are filtered against the live CRM segment
snapshot so `segment: "VIP"` sends to exactly the customers the UI shows.

## 6. Privacy: export and deletion

- **Export** (`GET /customers/:id/export`) returns the customer row plus every
  order, payment, reservation, waitlist entry, loyalty ledger/rewards and
  campaign delivery/event tied to them. The UI downloads it as JSON.
- **Deletion** (`DELETE /customers/:id`) runs in a transaction and:
  - nulls names/phones on orders and `mpesaPhone` on payments
  - redacts reservation and waitlist names/phones to `Deleted customer` /
    `0000000000` (columns are `NOT NULL`) and clears notes
  - detaches campaign deliveries/events and redacts delivery phones
  - deletes the customer row (loyalty cascades)
- Only the minimum PII needed is stored: name/phone/email as supplied, plus
  order history. No payment credentials are ever stored on the customer.

All actions are audit-logged (`auditLog` on update/delete routes).

## 7. Loyalty coupling

Loyalty reads customers through the same normalised lookup, so points and
rewards are attributed correctly regardless of which format created the row.
Points are awarded **once per order** (checked against
`LoyaltyTransaction(referenceType=ORDER, referenceId=orderId)`) and rewards are
issued at most once per rule+order, so a retried M-Pesa callback cannot mint
duplicate points or rewards.

## 8. API summary

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/customers` | `search`, `segment`, `page`, `perPage`; returns `data`, `meta`, `segments` |
| `GET` | `/api/v1/customers/:id` | profile + favourites + `segments` + recent orders |
| `PUT` | `/api/v1/customers/:id` | name/email/notes/consent/opt-out/channel |
| `GET` | `/api/v1/customers/:id/export` | GDPR-style JSON export |
| `DELETE` | `/api/v1/customers/:id` | anonymising deletion |

All routes require authentication and are restaurant-scoped by middleware.

## 9. Known limitations

- Historical totals are not re-derived; only new events are counted correctly.
- The CRM list returns up to 100 rows per request; segment counts remain global.
- Behaviour segments ignore orders older than 180 days by design.
- Meta WhatsApp delivery receipts are not wired, so campaigns report sent/failed
  only.
