# M-Pesa Integration — What You Need From the Client (Real Environment)

This is the checklist for getting real M-Pesa payments working for a client — the kind of payments
where money actually moves from a customer's phone into the **client's own till or paybill**.

---

## The big idea first (explain it like this to the client)

> "When a customer pays, the money goes **directly into YOUR M-Pesa till or paybill**. We never
> receive, hold, or touch your money. We only receive a confirmation message that payment
> succeeded, so we can mark the order as paid."

This one sentence answers most of their worries.

---

## The checklist — what to collect from the client

### 1. Their M-Pesa number (choose ONE)

| Type | Example | Best for |
|---|---|---|
| **Paybill** | `247247` | Businesses that already use a paybill |
| **Till number (Buy Goods)** | `5273012` | Small restaurants and food stalls |

- The number must be **registered and active** with M-Pesa.
- It must belong to the business (or the owner) — the name on it shows on customers' payment prompts.

### 2. The M-Pesa **passkey** for that number

This is the most important piece and the one clients don't know they have.

- The passkey is a long secret code that links YOUR system to THEIR number.
- It comes from **Safaricom's developer portal** (Daraja): `developer.safaricom.co.ke`
- The client must log in there (or give you access) and do this:
  1. Go to **My Apps** (or the app created for their business).
  2. Add / select their **paybill or till number** under **Lipa Na M-Pesa Online (STK Push)**.
  3. Accept Safaricom's terms.
  4. The portal then shows the **Passkey / Secret Key** for that number.
- Send it to you securely (WhatsApp is fine for a first setup; suggest they keep it private).

> ⚠️ If the client is not registered on the Daraja portal yet: they need to create an account,
> verify their business, and add the paybill/till. Takes 30–60 minutes. Offer to walk them through
> it on a call.

### 3. The business name registered with M-Pesa

- Shown on the customer's payment prompt ("Pay to: XXXX").
- Must match the name Safaricom has for that till/paybill (otherwise customers get confused).

### 4. Their Safaricom phone number (to test)

- Any Safaricom number with M-Pesa registered, e.g., `2547XX XXX XXX`.
- Used by YOU to send a test STK push after setup.

### 5. (Optional but recommended) KRA PIN and business registration

- Already collected in their profile for ETR receipts.
- Needed if they want compliant receipts.

---

## What you need from Safaricom (your side — once)

These are YOUR credentials, set up once for the whole system (you can also do per-client apps later):

| Item | Where from |
|---|---|
| **Consumer Key** | Daraja portal → your app |
| **Consumer Secret** | Daraja portal → your app |
| **API environment** | `sandbox` for testing, `production` for real money |
| **Callback URL** | Your public server address, e.g. `https://yourbackend.com/api/v1/payments/mpesa/callback` |

**Important:** Safaricom only sends callbacks to a **public HTTPS address** (not `localhost`).
During testing from your computer, use a tunnel like `ngrok` (`ngrok http 3001`) and put that
address in the callback setting.

---

## How it flows (real payment, step by step)

```
1. Customer places an order and chooses M-Pesa
2. System asks Safaricom to send a payment request (STK push) to the customer's phone
3. Customer sees "Pay XXXX" on their phone → enters M-Pesa PIN
4. Money moves from customer → CLIENT'S till/paybill (we never see it)
5. Safaricom sends us a confirmation (callback)
6. System marks the order PAID and frees the table
```

---

## Where the client's details go in the system

1. Log in to the owner dashboard → **Settings** → **Payments**.
2. **M-Pesa (STK Push)** section:
   - **Active M-Pesa Number**: the client's paybill or till number.
   - **M-Pesa Passkey**: the passkey from the Daraja portal.
   - **Business Name**: the M-Pesa-registered business name.
3. Save. Enable the **M-Pesa** toggle if it isn't on.

The system remembers these per restaurant — every restaurant can have its OWN till/paybill.

---

## Testing checklist before you launch a client

- [ ] Test STK push reaches the test phone (sandbox first, then production).
- [ ] Customer enters PIN → money lands in the client's till/paybill (confirm with the client).
- [ ] Order automatically becomes PAID in the system.
- [ ] Receipt shows the M-Pesa reference number.
- [ ] Table frees automatically after payment.
- [ ] Callback URL is HTTPS and reachable from the internet.

---

## Common problems and fixes

| Problem | Likely cause | Fix |
|---|---|---|
| "M-Pesa credentials not configured" | No Consumer Key/Secret in the server settings | Add `MPESA_CONSUMER_KEY`/`SECRET` to the server |
| STK push never arrives | Wrong phone format, or testing in sandbox (sandbox only pushes to the test number `254708374149`) | Use `2547XXXXXXXX`; use production credentials for real pushes |
| "Phone must be a Safaricom number" | Customer entered an Airtel/Safaricom-registered check fails | M-Pesa works only on Safaricom numbers (07XX/01XX/2547/2541) |
| Payment succeeds but order stays unpaid | Callback URL unreachable | Ensure `MPESA_CALLBACK_URL` is public HTTPS; test with ngrok in dev |
| Wrong business name on prompt | Name mismatch with Safaricom records | Update the **Business Name** field or Safaricom's records |
| Duplicate pending payment error | Customer pressed pay twice | System blocks a second push for 5 minutes — wait or use a new session |

---

## Security rules (protect yourself and the client)

1. **Never ask the client for their M-Pesa PIN** — only the passkey from the Daraja portal. The PIN is personal and never needed.
2. **Never store the passkey in plain view** — it lives in the system settings; don't share it in group chats.
3. **M-Pesa consumer keys/secrets** are yours — keep them in server environment variables, not in code.
4. **Production vs sandbox**: use sandbox only while testing. Real money needs `production` environment — never mix them up.
5. Keep a record of the client's till/paybill number in your own notes (not the passkey) for support.
