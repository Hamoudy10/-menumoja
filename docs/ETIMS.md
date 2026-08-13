# MenuMoja — KRA eTIMS Integration Guide

> **Compliance rule (non-negotiable):** MenuMoja **never** marks a receipt
> "compliant" from local success. A receipt is only ever reported as
> **SUBMITTED to KRA** (backed by the KRA-returned invoice number) or as
> PENDING / FAILED / REJECTED. The dashboard and this document state this
> explicitly, everywhere.

## 1. Current status

The eTIMS layer (migration 13 + `integrations/etims.ts` + `services/etims.service.ts`)
provides:

- A per-receipt **submission ledger** (`etr_submissions`) with status
  (PENDING / SUBMITTED / FAILED / REJECTED), attempt count, last error,
  KRA response code/message, the KRA invoice number when returned, and the
  exact payload sent (audit trail).
- A **KRA adapter** with sandbox/production separation, cached token auth,
  an A1-style receipt payload builder, and normalized submit results
  (ok / retryable / responseCode / message / invoiceNumber).
- A **manual process trigger** (`POST /etims/process`) and a status view
  (`GET /etims/status`).
- Receipts automatically get a PENDING submission row at creation.

Without `ETIMS_*` credentials the adapter is a **safe no-op**: receipts stay
PENDING and are surfaced to the owner — nothing is sent anywhere.

## 2. What must be VERIFIED against KRA before production

The adapter intentionally encodes best-known field names and endpoints, all
flagged `// VERIFY` in `backend/src/integrations/etims.ts`. Before any
production submission, confirm against KRA's current eTIMS developer
documentation:

- [ ] Base URLs for sandbox and production (`ETIMS_SANDBOX_URL`, `ETIMS_BASE_URL`)
- [ ] Authentication endpoint + payload + token lifetime
- [ ] Receipt/invoice submission endpoint path (`saveReceipt` assumed)
- [ ] A1 self-issued receipt schema field names and codes:
      `bhfId`, `dvcSrlNo`, `sdcId`, `mrcNo`, `sarNo`, `rcptTyCd`, `pmtTyCd`,
      `salesTyCd`, `rcptPbctDate`, `taxTyCd`, item list fields
- [ ] Success/rejection result codes (`0000` assumed for success)
- [ ] Sandbox test credentials and test TIN
- [ ] Whether customer TIN collection is mandatory (for B2B) and how to
      handle walk-in (B2C) receipts

> This verification requires a live (or KRA-approved) connection to the KRA
> portal — it cannot be completed from code alone. Do not enable
> `ETIMS_ENV=production` until it is done.

## 3. Environment variables

| Variable | Purpose |
|---|---|
| `ETIMS_ENV` | `sandbox` (default) or `production` |
| `ETIMS_SANDBOX_URL` / `ETIMS_BASE_URL` | Override base URLs (defaults documented in the adapter) |
| `ETIMS_USERNAME` / `ETIMS_PASSWORD` | KRA eTIMS credentials |
| `ETIMS_BRANCH_ID` | Branch id (default `00`) |
| `ETIMS_DEVICE_SERIAL` / `ETIMS_DEVICE_ID` | Registered device identifiers from the eTIMS portal |

Set these in Render/Railway env vars, **not** in the repo.

## 4. Submission lifecycle

```
receipt created ─▶ EtrSubmission PENDING
                     │
        ┌────────────┴─────────────┐
        │ configured?              │
        │  no  ─▶ stays PENDING    │  (owner sees it in /etims/status)
        │  yes ▼
        ▼
   POST to KRA (A1 payload)
        │
        ├─ success ─▶ SUBMITTED + kraInvoiceNumber (evidence)
        ├─ business rejection ─▶ REJECTED (no auto-retry — fix data, manual reset)
        └─ network/provider error ─▶ FAILED (retryable, max 5 attempts)
```

The processing entry point is `processPendingSubmissions` — currently
triggered manually via `POST /etims/process` (audited). A scheduled trigger
belongs to the BullMQ phase.

## 5. Receipt data requirements

For submission to succeed the restaurant needs a **valid KRA PIN**:
- `Restaurant.kraPin` (Settings → Profile → KRA PIN).
- VAT fields on the receipt (`vatAmount`, 16% VAT-inclusive math).
- A registered eTIMS device (serial + device id) on the KRA portal,
  configured via env vars.

## 6. Definitions of honesty (what the UI may and may not claim)

| Term | Allowed claim |
|---|---|
| `SUBMITTED` | "Sent to KRA eTIMS" + KRA invoice number |
| `REJECTED` | "Rejected by KRA — fix and resubmit" |
| `FAILED` | "Submission failed — will retry" |
| `PENDING` | "Waiting to be submitted to KRA" |
| "Compliant" / "ETR-approved" | **Never** — not without the KRA-returned invoice number, and even then only per the restaurant's own tax advice |

## 7. Rollout checklist for a pilot restaurant

1. Restaurant has a KRA PIN (stored in Settings).
2. Owner registers the business + device on KRA eTIMS (device serial/id).
3. `ETIMS_*` env vars set on the backend.
4. One test receipt created → `POST /etims/process` → confirm `SUBMITTED`
   with a KRA invoice number in the sandbox.
5. Verify the KRA portal shows the invoice.
6. Only then consider `ETIMS_ENV=production`.
