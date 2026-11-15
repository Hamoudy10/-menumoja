# Orders, Scans, Payments & Reservations — Wiring Audit

> **Date:** 2026-11-15
> **Scope:** Verify the four core money paths end-to-end and fix gaps found.

---

## 1. What was already wired

| Flow | Verified behaviour |
|---|---|
| **Orders** | Customer and POS creation, idempotency, stock checks, table status, customer upsert, WhatsApp, sockets, status transitions, cancel/refund. |
| **Payments** | Cash/card/M-Pesa recording, amount guards, idempotency, receipts, shifts/reconciliation, customer spend + loyalty + campaign conversion, sockets. |
| **Reservations** | Create → table `RESERVED`, check-in → `OCCUPIED`, cancel/no-show → `FREE`; waitlist positions and seating. |
| **Scans** | `x-qr-code-id` → `QrScan` + `qrCode.scanCount` + `AnalyticsDaily.totalScans`; analytics reads `QrScan` directly. |

---

## 2. Gaps found and fixed

### 2.1 QR table was dropped from customer orders (critical)

`MenuCart` sent `tableNumber`, but `customerCreateOrderSchema` did not allow it.
Zod strips unknown keys, so `tableNumber` was always `undefined` and:

- the order was never linked to a table,
- the table was never marked `OCCUPIED`,
- `freeTableIfLastOrder` could never free it (no `tableId`).

Fixes:

- `tableNumber` (nullable int) and `qrCodeId` added to the public order schema.
- `qrCodeId` is validated against the restaurant before being stored on the order.
- Order now stores `tableId: seatedTableId || tableId` (it previously used only the
  request-body `tableId`, ignoring the table resolved from `tableNumber`).
- POS orders with a `tableNumber` now resolve the table, store `tableId`, mark it
  `OCCUPIED` and start a table session (`onTableSeated`).

### 2.2 Scans were only counted on cache misses

`trackQrScan` ran **after** the Redis cache lookup, so only the first visitor
per cache window was recorded. It now runs **before** the cache lookup.

Also:

- QR URLs now include `?qr=<qrCodeId>` (single and batch generation).
- Editing a QR's table rebuilds the URL with `URLSearchParams`, preserving `qr`
  (legacy rows gain a `qr` on regeneration).
- `MenuView` forwards the scan id and its anonymous session with the menu
  request, and carries them through the cart to the order.
- Legacy printed codes without `?qr=` are attributed by `table` when possible.
- Reloads from the same session within 30 minutes do not double-count, so the
  scan metric tracks arrivals rather than refreshes.

### 2.3 Menu popularity was never recorded

`MenuItem.totalOrders` (most-popular on the customer menu, top item on the
dashboard) and `MenuItemAnalytics` were never written. Added
`order-analytics.service.ts`, called after customer and POS order creation:

- increments `MenuItem.totalOrders` by quantity,
- upserts daily `MenuItemAnalytics.orders` / `revenue`,
- upserts `AnalyticsDaily.totalOrders` / `itemsSold`.

Analytics failures are logged and never block an order.

### 2.4 M-Pesa payments left tables occupied

Manual cash/card payments freed the table, but the M-Pesa callback only set
`paymentStatus = PAID`. Both `updateOrderPayment` implementations now release
the table through the same rule as manual payments.

### 2.5 Tables could be freed before guests finished

Table release now requires **paid + served**:

- `freeTableWhenFinished()` only frees when `paymentStatus = PAID` and
  `status = SERVED`.
- Prepaid QR orders no longer free the table while the meal is in progress.
- Marking an order `SERVED` frees a table that was already paid.

### 2.6 Reservation edge cases

- Cancelling/completing a checked-in reservation now frees an `OCCUPIED` table
  (previously only `RESERVED`).
- `COMPLETED` now frees the table.
- Check-in without a pre-assigned table auto-assigns the smallest free table
  that fits the party.
- Waitlist seating used the *add-party form* size for capacity matching (and a
  `|| true` made it meaningless); it now uses the seated entry's `partySize`
  and prefers a table that fits.

---

## 3. Tests added

- Customer order with `tableNumber` + `qrCodeId` stores both, links `tableId`
  and marks the table `OCCUPIED`.
- Cached public menu requests still create a `QrScan`, increment scan counters
  and update `AnalyticsDaily`.

Full suite: **27 suites / 229 passed / 1 skipped**, backend typecheck clean,
frontend build clean, lint **0 errors**.

---

## 4. Notes / remaining behaviour

- `MenuItemAnalytics.views` is still never written (there is no per-item view
  event). The analytics "views" sort therefore reads zero until a view endpoint
  is added; orders/revenue are accurate.
- `AnalyticsDaily` revenue fields are not maintained per order (payments remain
  the source of truth for revenue).
- Table release depends on staff marking the order `SERVED`; if a restaurant
  skips that step, staff can still free the table manually from Tables.
