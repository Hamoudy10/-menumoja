# MenuMoja — Complete System Overview & Technical Documentation

> **Purpose of this document:** This is a detailed, technical system overview of the MenuMoja project intended to give an AI (or any new developer) full context about the codebase — what the system does, how it is architected, how every piece works, and where everything lives. It covers the frontend, backend, database schema, integrations, deployment, and business context.

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Business Context & Product Model](#2-business-context--product-model)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Repository Layout](#5-repository-layout)
6. [Database Schema (Prisma / PostgreSQL)](#6-database-schema-prisma--postgresql)
7. [Backend Deep Dive](#7-backend-deep-dive)
8. [Frontend Deep Dive](#8-frontend-deep-dive)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Realtime Strategy (Socket.io & Polling)](#10-realtime-strategy-socketio--polling)
11. [Payments: M-Pesa Flow](#11-payments-m-pesa-flow)
12. [Integrations Catalog](#12-integrations-catalog)
13. [Background Jobs & Scheduling](#13-background-jobs--scheduling)
14. [Security Measures](#14-security-measures)
15. [Error Handling & API Conventions](#15-error-handling--api-conventions)
16. [Testing](#16-testing)
17. [Environment Variables](#17-environment-variables)
18. [Deployment & Infrastructure](#18-deployment--infrastructure)
19. [Frontend Routing Map](#19-frontend-routing-map)
20. [Known Caveats & Technical Debt](#20-known-caveats--technical-debt)

---

## 1. Project Summary

**MenuMoja** ("Moja" = "one" in Swahili) is a **multi-tenant SaaS platform for restaurant management**, primarily targeting restaurants in **Mombasa, Kenya**. It replaces paper menus with a full digital ecosystem:

- **Digital QR-code menus** — each restaurant gets a public menu URL (`/menu/{restaurantSlug}`) reachable via printed QR codes placed on tables (or for takeaway/general use). Menus are tri-lingual (English / Swahili / Arabic, with Arabic RTL support).
- **Customer self-ordering** — customers scan the QR code, browse the menu, add items to a cart, place orders (with M-Pesa STK push or cash payment), and track order status live.
- **Owner dashboard** — restaurant owners manage menu items, categories, promotions, tables (floor plan editor), orders, payments, staff, analytics, QR codes, camera surveillance, and settings.
- **Staff dashboards** — role-specific screens for **waiters**, **cashiers** (full POS with ETR-compliant receipts and cash reconciliation), and **kitchen display** (KDS with order timers).
- **Chef AI assistant** — an LLM-powered chatbot embedded on customer menus that answers questions about the menu, recommends dishes, and can even add suggested items to the customer's cart. There is also an owner-setup AI chat and an AI landing-page assistant.
- **Ordering via SMS & USSD** — Kenya-specific channels: customers can browse/menu/order via SMS commands and a Swahili USSD state machine.
- **Platform administration** — a super-admin panel to manage restaurants, subscriptions, support tickets, and broadcast messages.
- **Camera surveillance (Premium)** — IP camera management with RTSP stream proxying, connection testing, and AI alert feeds.

The codebase contains **two apps in one monorepo folder**:

| App | Location | Description |
|---|---|---|
| Frontend (SPA) | repository root (`src/`) | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 |
| Backend (API) | `backend/` | Express 5 + TypeScript + Prisma (PostgreSQL) + Redis + Socket.io + BullMQ |

The root `README.md` is **still the default Vite template README** and does not describe the project — this document is the authoritative reference.

---

## 2. Business Context & Product Model

### 2.1 Who it serves
- **Restaurants, hotels, cafes, fast-food outlets, bars** in Kenya (Mombasa-first).
- Money flows **directly into the restaurant's own M-Pesa till/paybill** — MenuMoja is a software platform and never touches client money.

### 2.2 Pricing / subscription model
Three seeded subscription plans (see `backend/prisma/seed.ts`):

| Plan | Price | Limits | Features |
|---|---|---|---|
| **Starter** | KES 1,500/mo (15,000/yr) | 20 menu items, 10 tables | Ordering only |
| **Business** | KES 3,500/mo (35,000/yr) | 50 items, 25 tables | + analytics, surveillance, AI, USSD |
| **Premium** | KES 7,500/mo (75,000/yr) | — | + multi-branch |

New restaurants get a **14-day TRIAL** subscription. The platform charges suggested setup fees/commissions (see `docs/SELLING_STRATEGIES.md` for the sales playbook).

### 2.3 Supporting docs in `docs/`
- `docs/FEATURES.md` — plain-language feature explainer (customer-facing description of everything the system does).
- `docs/MPESA_INTEGRATION.md` — client onboarding checklist for real M-Pesa (paybill vs till, Daraja portal, sandbox testing, troubleshooting).
- `docs/SELLING_STRATEGIES.md` — pricing/profit math and sales scripts.
- `docs/SETUP_SCENARIOS.md` — cheapest production-ready hosting setups (shared Supabase + Render + Vercel, or per-client dedicated VPS with docker-compose).
- `test-menu-data.md` — a realistic Kenyan coastal restaurant menu dataset (7 categories, ~30 items with trilingual data, dietary flags, allergens) used for demos/seeding.

The vendor brand is **BadikuuTech Solutions** (contact: badikuutechsolutions@gmail.com) — referenced in Help pages and copyright notices.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER DEVICE (phone)                                                │
│  Scans QR → opens /menu/{slug} → browses → orders → M-Pesa STK / cash  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND — Vite SPA (React 19 + TS + Tailwind v4)                      │
│  Deployed: Vercel (menumoja.vercel.app)                                 │
│  - /api/v1/* proxied by vercel.json rewrite → Render backend            │
│  - Local dev: Vite dev proxy /api/v1 → http://localhost:3001            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND — Express 5 + TypeScript (backend/)                            │
│  Deployed: Render or Railway via Docker (backend/Dockerfile), port 3001 │
│  Mounts 14 routers under /api/v1/*                                      │
│  + Socket.io (websocket + polling)  + BullMQ queues  + job scheduler    │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma ORM)         Redis (tokens/OTP/cache/rate-limit)    │
│  + External APIs: Safaricom Daraja (M-Pesa), Africa's Talking (SMS/     │
│    USSD), Cloudinary (images), Resend (email), DeepSeek/OpenAI (LLM),   │
│    HuggingFace (images), Meta Graph (FB/IG/WhatsApp), Google Maps,      │
│    Sentry (errors)                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Request flow (customer ordering):**
1. Customer scans QR (`{FRONTEND_URL}/menu/{slug}?table={n}`).
2. Frontend calls `GET /api/v1/menu/public/{slug}` (optionally sending `x-qr-code-id` + `x-session-id` headers). Backend serves the menu from a **60-second Redis cache**, and records the scan (increments `scanCount`, creates a `qrScan` row with device/browser/IP, and updates daily analytics).
3. Customer adds items to cart → `POST /orders/public/create`. Backend validates items against the DB, computes totals (VAT-inclusive, service charge), marks the table OCCUPIED, and emits `order:new` over Socket.io to the `restaurant:{id}` room.
4. Kitchen/waiters see the order via polling (frontend polls every ~15s) or socket events.
5. Customer pays via M-Pesa STK push (`POST /payments/mpesa/initiate`) or cash. Safaricom calls back the backend (`POST /payments/mpesa/callback`), which validates IP, dedupes via Redis idempotency, updates the payment + order, and emits `payment:completed` / `order:paid` events.

---

## 4. Technology Stack

### 4.1 Frontend (`package.json`)
| Technology | Purpose |
|---|---|
| React 19, react-dom 19 | UI framework |
| TypeScript ~6.0 (strict) | Typed language |
| Vite 8 | Build tool / dev server |
| Tailwind CSS 4 (`@tailwindcss/vite`) | CSS-first styling with `@theme` tokens |
| Zustand 5 | Global state (single store) |
| React Router 6 | Routing |
| i18next + react-i18next + browser-languagedetector | i18n (en/sw/ar) |
| axios | HTTP client with auth interceptors |
| react-hook-form + zod (@hookform/resolvers) | Forms + validation |
| framer-motion | Animations / page transitions / drag-reorder |
| recharts | Analytics charts |
| qrcode.react | QR code rendering (onboarding, demo) |
| lucide-react | Icons |
| react-hot-toast | Toasts |
| @react-oauth/google | Google OAuth sign-in |
| react-intersection-observer | Scroll animations (landing) |
| date-fns | Date helpers |
| vite-plugin-pwa | Listed but **not configured** (see caveats §20) |

### 4.2 Backend (`backend/package.json`)
| Technology | Purpose |
|---|---|
| Express 5 | HTTP framework |
| TypeScript ~5.7 (CommonJS, non-strict) | Typed language |
| Prisma 6 + @prisma/client | ORM (PostgreSQL) |
| ioredis | Redis client |
| Socket.io 4 | Realtime events |
| BullMQ | Background job queues |
| zod 3 | Request validation |
| jsonwebtoken | JWT access/refresh tokens |
| bcryptjs | Password + staff PIN hashing |
| crypto-js | AES-256-CBC encryption (camera passwords) |
| helmet, cors, compression, morgan, cookie-parser, express-rate-limit | HTTP hardening / middleware |
| multer | File uploads |
| sharp, qrcode, pdfkit | QR PNG rendering, image processing, PDF receipt/card generation |
| cloudinary | Image CDN |
| openai | LLM SDK (also used for DeepSeek via compatible base URL) |
| axios | HTTP client for external APIs |
| @sentry/node | Error monitoring |
| winston | Logging (console + rotating files) |
| uuid, slugify, date-fns | Utilities |
| google-auth-library | Google OAuth token verification |
| Jest + ts-jest + supertest | Testing |

---

## 5. Repository Layout

```
menu-moja/
├── .env / .env.example          # Frontend env vars (VITE_API_URL, VITE_GOOGLE_CLIENT_ID, ...)
├── .github/workflows/keep-awake.yml   # Cron ping to keep Render backend awake
├── index.html                   # SPA shell, fonts, SEO meta, service-worker kill-switch
├── vite.config.ts               # React + Tailwind plugins, dev proxy, chunk splitting
├── package.json / tsconfig*.json / eslint.config.js
├── Dockerfile                   # Legacy root backend Dockerfile (backend/Dockerfile is canonical)
├── render.yaml                  # Render blueprint: web service + managed Redis
├── vercel.json                  # Vercel: Vite build + /api/v1 proxy rewrite to Render
├── railway.json                 # Railway deploy (backend/Dockerfile)
├── test-menu-data.md            # Demo coastal-restaurant menu dataset
├── docs/                        # Business/docs: FEATURES, MPESA_INTEGRATION, SELLING_STRATEGIES, SETUP_SCENARIOS, SYSTEM_OVERVIEW (this file)
├── public/                      # robots.txt, favicon.svg, icons.svg (sprite)
├── src/                         # FRONTEND (React app)
│   ├── main.tsx                 # Entry: StrictMode → ErrorBoundary → BrowserRouter, chunk-reload guard
│   ├── App.tsx                  # All routes, lazy loading, providers, theme, toaster
│   ├── index.css                # Tailwind v4 @theme tokens + keyframes + RTL support
│   ├── api/                     # Axios API layer (client + 14 modules)
│   ├── store/useStore.ts        # Single Zustand store (~990 lines)
│   ├── types/index.ts           # All shared TS types
│   ├── utils/                   # security.ts, image.ts
│   ├── i18n/                    # i18next setup + locales (en.json, sw.json, ar.json)
│   ├── hooks/useRestaurantTheme.ts
│   ├── components/              # ui/, customer/, dashboard/, landing/, layout/, floor/, pos/,
│   │                            # onboarding/, notifications/, admin/, theme/, ErrorBoundary
│   └── pages/                   # landing, auth, menu (customer), onboarding, dashboard, staff, admin
└── backend/
    ├── package.json             # "menumoja-backend"
    ├── Dockerfile               # CANONICAL backend container (npm ci, prisma generate, start.sh)
    ├── scripts/start.sh         # db push → conditional seed → run app (tsx)
    ├── .env / .env.example      # Backend secrets (names documented in §17)
    ├── prisma/schema.prisma     # Full data model (~30 models, ~20 enums)
    ├── prisma/seed.ts           # Plans, super admin, demo restaurant "Bahari Restaurant", 12 tables, 3 cameras
    ├── jest.config.ts           # ts-jest, roots: src + tests
    ├── src/
    │   ├── index.ts             # Express bootstrap: security middleware, routes, health, sockets, scheduler, graceful shutdown
    │   ├── config/              # index.ts (typed env config), database.ts (Prisma singleton), redis.ts (resilient Redis w/ memory fallback)
    │   ├── middleware/          # auth, authorization, multitenant, rateLimiter, validate, errorHandler, audit
    │   ├── routes/              # index.ts barrel + 14 route modules (auth, restaurant, menu, menu/public,
    │   │                        #   qrcodes, orders, payments, ai, surveillance, analytics, admin, ussd, sms, notifications)
    │   ├── services/            # auth.service, ai.service, mpesa.service, table.service (DI pattern)
    │   ├── hooks/socket.ts      # Socket.io init + room/event helpers
    │   ├── jobs/                # queue.ts (BullMQ queues), scheduler.ts, workers.ts (log-only stubs)
    │   ├── integrations/        # mpesa, africasTalking, cloudinary, email, googleMaps, huggingface, meta, openai, whatsapp
    │   ├── utils/               # cache, encryption, errors, helpers, logger, validation (~40 zod schemas), index
    │   └── types/               # index.ts (API envelope, JWT payload), declarations.d.ts
    ├── tests/                   # Jest + supertest: auth, menu, orders, payments, restaurant, analytics + helpers
    ├── dist/                    # Compiled output (committed? no — build artifact)
    ├── logs/                    # Winston output (combined.log, error.log)
    └── MenuMoja - Smart Restaurant Management for Mombasa.pdf  # sales deck (deliverable)
```

---

## 6. Database Schema (Prisma / PostgreSQL)

`backend/prisma/schema.prisma` — PostgreSQL, `relationMode = "prisma"`, UUID primary keys, snake_case table/column names. **~33 models, ~20 enums.** All monetary fields are `Decimal`.

**Migrations:** ✅ since 2026-08-12 — `backend/prisma/migrations/` contains a baseline (34 tables) plus `1_order_idempotency` (Order.idempotencyKey + composite unique), `2_audit_log` (AuditLog), and `3_receipts` (Receipt). `backend/scripts/start.sh` applies them via `prisma migrate deploy` (replacing the former `db push --accept-data-loss`).

### 6.1 Enums

| Enum | Values |
|---|---|
| `PlatformAdminRole` | SUPER_ADMIN, SUPPORT_ADMIN |
| `SubscriptionStatus` | ACTIVE, EXPIRED, TRIAL, SUSPENDED |
| `LayoutStyle` | GRID, LIST |
| `DayOfWeek` | MON…SUN |
| `SpiceLevel` | NONE, MILD, MEDIUM, HOT, VERY_HOT |
| `QRType` | TABLE, GENERAL, TAKEAWAY |
| `StaffRole` | WAITER, CASHIER, KITCHEN, MANAGER, OWNER |
| `TableStatus` | FREE, OCCUPIED, RESERVED, UNAVAILABLE |
| `OrderStatus` | PENDING, CONFIRMED, PREPARING, READY, SERVED, CANCELLED |
| `PaymentStatus` | PENDING, UNPAID, PARTIAL, PAID, REFUNDED |
| `OrderPaymentMethod` | MPESA, CASH, CARD, SPLIT, PENDING |
| `PaymentMethod` | MPESA, CASH, CARD |
| `CashStatus` | OPEN, CLOSED, DISCREPANCY_FLAGGED |
| `ConversationType` | CUSTOMER_CHAT, OWNER_SETUP |
| `AIContentType` | MENU_DESCRIPTION, SOCIAL_POST, RESTAURANT_DESC, IMAGE |
| `AlertType` | MOTION_AFTER_HOURS, UNATTENDED_TABLE, CASH_AREA_ACTIVITY, CAPACITY_HIGH, STAFF_ABSENT |
| `SmsDirection` | INBOUND, OUTBOUND |
| `SmsStatus` | SENT, DELIVERED, FAILED |
| `RecipientType` | OWNER, STAFF, PLATFORM_ADMIN |
| `NotificationType` | NEW_ORDER, PAYMENT_RECEIVED, PAYMENT_FAILED, LOW_STOCK, CAMERA_ALERT, SOCIAL_POST_PUBLISHED, REVIEW_RECEIVED, SUBSCRIPTION_EXPIRING |
| `PromotionType` | SPECIAL, OFFER, EVENT, GIVEAWAY |

### 6.2 Models (grouped by domain)

**Platform / billing**
- **`PlatformAdmin`** — platform super admins (`platform_admins`). Fields: name, email (unique), passwordHash, role, lastLogin.
- **`SubscriptionPlan`** — name, priceMonthlyKes, priceYearlyKes, maxMenuItems, maxTables, feature booleans: hasOrdering, hasAnalytics, hasSurveillance, hasUssd, hasMultiBranch, isActive.

**Ownership**
- **`Owner`** — the platform user. fullName, email (unique), phone (unique), passwordHash, isVerified, otpCode/otpExpiresAt, onboardingCompleted, onboardingStep.

**Restaurant core**
- **`Restaurant`** — tenant root. ownerId, name, **slug (unique, used in public menu URLs)**, description (+Swahili), logoUrl, coverPhotoUrl, coverVideoUrl, address, city (default "Mombasa"), latitude/longitude, phone, whatsapp, email, website, **KRA compliance fields** (kraPin, businessRegNo, vatRegNo, businessType), county, currency (default KES), isHalalCertified, dietaryOptions[], isActive, isSuspended + suspensionReason, planId, subscriptionStatus, trialEndsAt, planExpiresAt. Has relations to ~25 child tables.
- **`RestaurantSettings`** — 1:1 with restaurant. Branding: primaryColor (#2563EB default), secondaryColor (#F59E0B), fontFamily, gradientStart/End, useGradient, headingFont/bodyFont/accentFont, layoutStyle (GRID/LIST); content: welcomeMessage (+Sw), announcement + announcementActive; languages: languageEnglish/Swahili/Arabic; commerce: showPrices, allowOrdering, allowCashPayment, allowMpesaPayment, tipEnabled + tipPercentages[], serviceChargePercent (default 0), taxPercent (default 0); **per-restaurant M-Pesa credentials**: mpesaShortcode, mpesaPasskey, mpesaBusinessName.
- **`OpeningHour`** — 7 rows per restaurant (unique `[restaurantId, dayOfWeek]`), openTime/closeTime strings, isClosed.
- **`RestaurantBranch`** — multi-branch (Premium): branchName, address, phone, managerName, isActive.

**Menu**
- **`MenuCategory`** — name (+nameSw, nameAr), description, sortOrder, isActive.
- **`MenuItem`** — name (+nameSw/nameAr), description (+Sw/Ar), price, currency, photoUrl + photoUrls[], photoGeneratedByAi, isAvailable, isTodaysSpecial, isFeatured, isNew, preparationTimeMinutes, calories, dietary flags (isHalal, isVegetarian, isVegan, isGlutenFree), spiceLevel, containsNuts/Dairy/Seafood, allergenNotes, ingredients[], sortOrder, totalOrders (popularity counter).
- **`MenuItemSuggestion`** — join table: itemId → suggestedItemId (upsell pairs, unique pair).
- **`DailySpecialSchedule`** — itemId, specialPrice, startsAt/endsAt, isActive.
- **`Promotion`** — type (SPECIAL/OFFER/EVENT/GIVEAWAY), title, description (+Sw), optional menuItemId, specialPrice, imageUrl, startsAt/endsAt, isActive.

**QR / customer acquisition**
- **`QrCode`** — label, tableNumber?, qrType (TABLE/GENERAL/TAKEAWAY), qrImageUrl, qrCardPdfUrl, targetUrl (the full menu URL), scanCount, isActive.
- **`QrScan`** — per-scan analytics: qrCodeId, deviceType, browser, ipAddress, sessionId, languageUsed, scannedAt.

**Staff & operations**
- **`Staff`** — full HR record: employeeNumber, fullName, phone, email, nationalId, **kraPin, nhifNumber, nssfNumber**, dateOfBirth, address, emergencyName/Phone/Relation, nextOfKin (+phone/relation), bankName/Branch/Account, monthlySalary, hourlyRate, leaveDays (default 21), startDate, notes, **pinHash** (bcrypt, 4–6 digits), role (StaffRole), isActive, lastLogin.
- **`StaffShift`** — clockIn/clockOut, isActive (attendance).
- **`RestaurantTable`** — tableNumber (unique per restaurant), label, capacity, status, area, shape (ROUND/SQUARE/RECTANGLE/OVAL/BOOTH), **floor-plan geometry**: positionX/Y, width/height, rotation, zoneId, currentSessionId, qrCodeId.
- **`TableZone`** — floor-plan zone rectangles: name, color, positionX/Y, width/height.
- **`TableSession`** — seating session: tableId, guestCount, startedAt, endedAt (used for occupancy tracking).

**Commerce**
- **`Order`** — orderNumber (unique, e.g. `ORD-{last4}-{base36}-{uuid4}`), restaurantId, tableId/tableNumber, qrCodeId, **sessionId** (customer browser session), status, paymentStatus, paymentMethod, subtotal, serviceCharge, taxAmount, tipAmount, totalAmount, specialNotes, estimatedPrepMinutes, lifecycle timestamps (confirmedAt, preparedAt, servedAt, cancelledAt + cancelledReason), waiterId (assigned staff), customerName/customerPhone (takeaway identity).
- **`OrderItem`** — snapshot of item: menuItemId (nullable for POS free-text items), itemName, itemPrice, quantity, specialInstructions, subtotal.
- **`Payment`** — orderId, paymentMethod, amount, currency, status, M-Pesa fields: mpesaTransactionId (unique), mpesaPhone, mpesaCheckoutRequestId, mpesaReceiptNumber; cash fields: cashReceived, changeGiven, cashierId; processedAt, notes.
- **`CashReconciliation`** — shift-based cash control: cashierId, shiftStart/shiftEnd, expectedCash, actualCash, discrepancy, status (OPEN/CLOSED/DISCREPANCY_FLAGGED), notes. `expectedCash` is incremented on each cash payment recorded.

**AI**
- **`AiConversation`** — restaurantId, sessionId, conversationType (CUSTOMER_CHAT/OWNER_SETUP), messages (Json array, trimmed to last 40).
- **`RestaurantFaq`** — question/answer (+Sw), category, isActive, timesTriggered.
- **`AiGeneratedContent`** — contentType (AIContentType), promptUsed, generatedContent, imageUrl, wasUsed, wasModified.

**Surveillance**
- **`Camera`** — name, ipAddress, port (554 default), username, **passwordEncrypted** (AES-256-CBC), streamUrl, location, isActive, lastSeen.
- **`CameraAlert`** — cameraId, alertType (AlertType), description, thumbnailUrl, clipUrl, occurredAt, isReviewed/reviewedAt.

**Analytics**
- **`AnalyticsDaily`** — per restaurant per day (unique [restaurantId, date]): totalScans, totalOrders, totalRevenueKes, revenueMpesa, revenueCash, averageOrderValue, itemsSold, peakHour, newCustomers, aiQuestionsAsked.
- **`MenuItemAnalytics`** — per item per day: views, orders, revenue.
- **`SearchAnalytics`** — searchTerm, resultsFound, searchedAt.

**Channel sessions**
- **`UssdSession`** — Africa's Talking USSD session: sessionId (unique), phone, currentMenu, restaurantId?.
- **`SmsLog`** — inbound/outbound SMS audit: phone, direction, message, providerMessageId, status.
- **`Notification`** — in-app notifications: restaurantId, recipientType (OWNER/STAFF/PLATFORM_ADMIN), recipientId, type, title, message, data (Json), isRead/readAt.

### 6.3 Pricing note (`helpers.calculateTotals`)
Orders are **VAT-inclusive**:
- `serviceCharge = 5% of subtotal`
- `tax = subtotal × 16/116` (the 16% VAT embedded in the price)
- `total = subtotal + serviceCharge`

---

## 7. Backend Deep Dive

### 7.1 Bootstrap (`backend/src/index.ts`)

Startup sequence:
1. Loads `.env` (root + `backend/.env`).
2. **Production guard:** refuses to start if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `ENCRYPTION_KEY` are missing.
3. Optional Sentry init (`SENTRY_DSN`, traces sample rate 0.1 in prod).
4. Global middleware stack (order matters):
   - `app.set('trust proxy', 1)`
   - `compression()` → `helmet()` with a custom CSP that allows Safaricom, DeepSeek, HuggingFace, Cloudinary, YouTube, Google Fonts; `crossOriginResourcePolicy: cross-origin`
   - `cors()` — origin from `FRONTEND_URL` (+ `http://localhost:5173` in dev), `credentials: true`, allowed headers include `x-session-id`, `x-qr-code-id`, `x-staff-pin`
   - `morgan` request logging (skipped in test env) → Winston
   - `express.json({limit:'1mb'})`, `urlencoded`, `cookieParser()`
   - requestId injector (uuid per request)
   - `generalLimiter` (100 req/min)
5. Route mounting (14 routers under `/api/v1` — full list in §7.3).
6. `GET /api/v1/health` — checks DB (`SELECT 1`) + Redis (`health:check` set), returns `{status: ok|degraded, timestamp, uptime, version, checks}` with 200/503.
7. 404 fallback (bilingual) + optional Sentry error handler + `errorHandler`.
8. Socket.io initialized on the HTTP server; job scheduler started (not in test).
9. **Graceful shutdown** on SIGTERM/SIGINT/uncaughtException: closes HTTP server, disconnects Prisma + Redis, 30s force-exit timeout. `unhandledRejection`/`uncaughtException` logged and sent to Sentry.

### 7.2 Config & infrastructure (`backend/src/config/`)

- **`config/index.ts`** — typed config object from env. Production requires `DATABASE_URL`, JWT secrets, `ENCRYPTION_KEY`, and at least one of `OPENAI_API_KEY`/`DEEPSEEK_API_KEY`. Resolves `aiProvider` to `deepseek` when `DEEPSEEK_API_KEY` set or `AI_PROVIDER=deepseek` (model `deepseek-v4-flash`), else `openai` (gpt-4o). Includes Cloudinary, M-Pesa (shortcode default **174379**), Africa's Talking (default USSD `*384*001#`, sender `MenuMoja`), Meta/WhatsApp, Google Maps, Resend, Sentry settings.
- **`config/database.ts`** — Prisma singleton on `globalThis` (dev hot-reload safe); query logging in dev.
- **`config/redis.ts`** — **resilient Redis wrapper**: if `REDIS_URL` unset or contains `localhost`, it uses an **in-memory Map fallback** implementing get/set/setex/del/expire/incr/exists/ttl/keys. If a non-local URL exists, ioredis is created (`lazyConnect`, `enableOfflineQueue: false`, 3× retry) and every method is wrapped in try/catch returning safe defaults — **the app never crashes when Redis is down.**

### 7.3 Route modules (all under `/api/v1`)

#### `auth` (`/auth`) — `backend/src/routes/auth/auth.routes.ts`
Rate-limited (5 req/min/IP). Endpoints:

| Method & Path | Notes |
|---|---|
| `POST /register` | Creates Owner + Restaurant + Settings + 7 opening hours in one transaction; picks first active SubscriptionPlan (creates "Free Trial" if none); generates unique slug; OTP stored in Redis `otp:{ownerId}` (600s); returns user + tokens (201) |
| `POST /google` | Google ID-token verification (`google-auth-library`); find-or-create owner + restaurant with 14-day TRIAL; returns tokens |
| `POST /verify-otp` | Verifies 6-digit OTP from Redis by phone; sets isVerified |
| `POST /resend-otp` | New OTP stored on the Owner row |
| `POST /login` | Email/phone + password; **brute-force lockout** via Redis `login_attempts:{identifier}` (max 5, 15-min TTL → 429 ACCOUNT_LOCKED); blocks suspended restaurants; issues tokens |
| `POST /refresh-token` | Validates refresh JWT + Redis store, rotates pair |
| `POST /forgot-password` | OTP to Redis `reset_otp:{email}` / `reset_otp:{phone}` |
| `POST /reset-password` | Validates OTP, hashes new password (≥8 chars), updates |
| `POST /staff/login` | **Staff PIN login** by `{pin, restaurantSlug}`; bcrypt-compares against each active staff member; role mapping WAITER→waiter, CASHIER→cashier, KITCHEN→kitchen, MANAGER→manager, OWNER→owner; returns staff + tokens + restaurant |
| `DELETE /logout` | Authenticated; invalidates refresh token(s) in Redis |

Tokens: access = 7 days, refresh = 30 days; payload `{userId, role, type, restaurantId}`; refresh stored at `refresh_token:{userId}:{tokenId}`.

#### `restaurant` (`/restaurant/me/...`) — owner-facing restaurant management
All protected by `authenticate` + `enforceRestaurantScope`; writes also `auditLog`. Response shape `{success, data}`.
- `GET /me` — full restaurant + settings + openingHours + tables + counts + plan. 403 if suspended.
- `PUT /me` — update profile; **renaming regenerates the slug and rewrites all QR targetUrls** (`/menu/{oldSlug}` → `/menu/{newSlug}`); branding fields split into RestaurantSettings upsert.
- `POST /me/upload-image` — base64 data URL (max 3 MB) → Cloudinary `logos/{restaurantId}`; falls back to storing the raw data URL if upload fails.
- `PUT /me/settings` — whitelisted field list incl. M-Pesa shortcode/passkey/business name.
- `GET|PUT /me/opening-hours` — bulk upsert of 7 days.
- `POST|GET /me/branches` — multi-branch CRUD.
- `GET|POST /me/tables` — list/create tables (unique `[restaurantId, tableNumber]`; defaults capacity 4, ROUND, 2×2 units).
- `PUT|DELETE /me/tables/:tableId` — update; delete blocked (409 TABLE_HAS_ACTIVE_ORDERS) if any active order.
- `PUT /me/tables/:tableId/status` — manual status; FREE ends open sessions; emits `table:status-changed`.
- `PUT /me/tables/:tableId/session` — `{action: START|END, guestCount?}`; START creates TableSession + marks OCCUPIED; END closes sessions.
- `GET|POST /me/zones`, `PUT|DELETE /me/zones/:zoneId` — floor-plan zones (delete unlinks tables first).
- `GET|POST /me/promotions`, `PUT|DELETE /me/promotions/:promotionId` — promotions CRUD; every mutation invalidates the menu cache.
- `GET|POST /me/staff`, `PUT|DELETE /me/staff/:staffId`, `POST /me/staff/:staffId/reset-pin` — staff CRUD with full HR fields; PIN generated/hashed, returned in plaintext **once**; delete blocked if staff has active assigned orders.

#### `menu` (`/menu`) — owner-facing menu management
All protected; every mutation calls `invalidateMenuCache(restaurantId)`.
- Categories: `GET /categories`, `POST /categories` (409 on duplicate name), `PUT /categories/:id`, `DELETE /categories/:id` (optional `?reassignToCategoryId=` to move items), `PUT /categories/reorder` (bulk sortOrder).
- Items: `GET /items` (filters: categoryId, available, special, search; pagination default 50 max 100 + meta), `GET /items/:id`, `POST /items` (currency hardcoded 'KES'; isTodaysSpecial/isFeatured from isSpecial/isPopular), `PUT /items/:id`, `DELETE /items/:id`, `PUT /items/reorder`, `PUT /items/:id/toggle` (isAvailable flip), `POST /items/bulk-update` (per-item results, non-atomic), `POST /items/:id/duplicate` (clones as "… (Copy)", unavailable).

#### `menu/public` (`/menu/public`) — customer-facing public menu
Rate-limited 100 req/min. **60-second Redis cache** (`menu:public:{slug}`).
- `GET /:restaurantSlug` — optional auth; returns sanitized restaurant, settings, openingHours, active (date-filtered) promotions, categories with active items. If `x-qr-code-id` header present: increments scanCount, creates QrScan (device/browser/IP/sessionId/language), upserts AnalyticsDaily totalScans.
- `GET /:restaurantSlug/item/:itemId` — single item detail.
- `GET /:restaurantSlug/search?q=` — search across name/nameSw/description/descriptionSw/ingredients (max 50); logs every search to SearchAnalytics.

#### `qr` (`/qr`) — QR code management
Protected (except `/scan/:qrCodeId`). `FRONTEND_URL` defaults `https://menumoja.app`.
- `GET /` — list with scan counts, linked table.
- `POST /generate` — builds `targetUrl = {FRONTEND_URL}/menu/{slug}?table={n}&source={type}`; renders 600px PNG (qrcode lib) → Cloudinary `qr-codes/{restaurantId}`; **auto-creates/links a RestaurantTable** when tableNumber given.
- `POST /generate-batch` — 1–100 tables, finds next free table number.
- `GET /:id` — detail + stats (total, today, unique sessions, byDevice, recent 20).
- `PUT /:id` — label/tableNumber; rewrites targetUrl.
- `DELETE /:id` — unlinks tables then deletes.
- `GET /:id/download` — 1200px PNG composited with restaurant logo + label (sharp).
- `GET /:id/pdf` — printable 400×600 card via **pdfkit** ("Scan to view menu", address, "Powered by MenuMoja").
- `POST /scan/:qrCodeId` — public scan tracker.

#### `orders` (`/orders`) — order lifecycle
**Status machine:** `PENDING → [CONFIRMED, PREPARING, CANCELLED]`, `CONFIRMED → [PREPARING, CANCELLED]`, `PREPARING → READY`, `READY → SERVED`; SERVED/CANCELLED terminal. Live-board priority: CONFIRMED=1, PREPARING=2, READY=3, PENDING=4.

Customer:
- `POST /public/create` — **anti-spam honeypot** (if a hidden `website` field is present, returns a fake 'SPAM' order), duplicate-order guard (same session, 60s → 422), max 3 active orders per session, item validation, `calculateTotals`, marks table OCCUPIED + session, M-Pesa initiation if paymentMethod MPESA, emits `order:new`.
- `GET /public/:orderId/status` — public tracking with `estimatedTimeRemaining`.

Staff/POS:
- `POST /` — POS order; supports **free-text items** (no menuItemId) and DB items; up to 100 line items.
- `GET /` — paginated, filtered by status/paymentStatus/date/table.
- `GET /live` — active orders sorted by priority, elapsed minutes included.
- `GET /history` — served/cancelled with search.
- `GET /export?startDate&endDate` — CSV download.
- `GET /kitchen` — **role-gated** (kitchen/manager/super_admin); MM:SS timers, `isOverdue` (elapsed > estimated or 20-min default).
- `GET /:id` — full detail, monetary fields cast to Number.
- `PUT /:id/status` — enforces transitions, sets timestamps, **auto-initiates M-Pesa refund if a PAID M-Pesa payment exists**, emits `order:status-changed` to restaurant + order rooms.
- `PUT /:id/assign-waiter`, `POST /:id/complaint` (log-only), `DELETE /:id` (cancel with refund + free table).

**Dependency injection:** route-local `createOrderService()` / `createPaymentService()` factories are passed into `mpesaService` — the service stays Prisma-decoupled and testable.

#### `payments` (`/payments`) — payments
M-Pesa:
- `POST /mpesa/initiate` — 10 req/min; validates order not paid/cancelled; blocks duplicate pending payment within 5 min; normalizes/validates Kenyan phone (`^254[17]\d{8}$`); calls `mpesaService.initiatePayment`.
- `POST /mpesa/callback` — **no auth**; production-only Safaricom IP whitelist (196.201.214.x, 196.201.213.x, 196.202.0.0/15); Safaricom-format response `{ResultCode, ResultDesc}`; Redis idempotency dedup; delegates to `mpesaService.handleCallback`.
- `GET /mpesa/:checkoutRequestId/status` — live query to Safaricom if pending.

Cash:
- `POST /cash/record` — validates amount ≤ total−discount, computes change, creates PAID payment with cashierId, increments open shift's expectedCash, emits `payment:recorded`, frees table if last order.
- `POST /cash/open-shift`, `POST /cash/close-shift`, `GET /cash/shifts` — reconciliation: discrepancy = actual − expected; > KES 100 → DISCREPANCY_FLAGGED.

General:
- `GET /` — paginated payments; `GET /receipts` — filtered by date/method/table/free-text; `GET /:id`; `GET /summary/today`; `GET /report?groupBy=day|week|month`; `GET /report/tax` (monthly totals + VAT collected); `POST /card/record`.

#### `ai` (`/ai`) — AI endpoints
- `POST /chat/customer` — 30 req/min, public; returns `{reply, suggestedItems, quickReplies}`.
- `POST /chat/owner-setup` — authenticated onboarding assistant.
- `POST /generate/description` (EN+SW, optional multiple options), `/generate/restaurant-description`, `/generate/image` (DALL-E 3 → Cloudinary), `/generate/free-image` (HuggingFace first, DALL-E fallback), `/enhance/image` (Cloudinary auto_brightness), `/generate/faq`, `/generate/social-post` (platform-aware caption + image + hashtags).
- `GET /conversations/:sessionId?restaurantId=` — last conversation for session.

#### `surveillance` (`/cameras`) — camera management
- `GET /:id/stream?token=` — **unauthenticated by design** (image tags can't send headers); checks a signed 2h stream JWT manually; proxies upstream RTSP-over-HTTP with AbortController; no-cache + CORS headers. All other routes require auth.
- `GET /`, `POST /` (builds `rtsp://user:pass@ip:port/live`, password AES-encrypted, background connection test), `GET /alert`, `PUT /alert/:alertId/review`, `GET|PUT|DELETE /:id`, `POST /:id/test`, `POST /:id/stream-token` (2h JWT), `GET /:id/alerts`.

#### `analytics` (`/analytics`) — analytics
Shared query schema: `period (today|week|month|year)`, `startDate/endDate`, `groupBy (hour|day|week|month)`, `limit`, `sortBy (revenue|orders|views)`, `format (pdf|excel)`.
- `GET /overview` — metrics + comparisons vs previous period (% change).
- `GET /revenue` — grouped revenue by method; `GET /orders`; `GET /menu-items` (top/bottom N); `GET /tables`; `GET /scans`; `GET /search-terms`; `GET /ai-questions`; `GET /export?format=pdf|excel` (PDF via pdfkit; "excel" is CSV).

#### `admin` (`/admin`) — platform administration
`authenticate` + `requireRole('SUPER_ADMIN')`. Email via direct Resend fetch.
- `GET /restaurants`, `GET /restaurants/:id` (+ recent orders).
- `PUT /restaurants/:id/suspend` — sets suspension + `subscriptionStatus: SUSPENDED`; **notifies owner via SMS + email**.
- `PUT /restaurants/:id/activate` — reactivates, `planExpiresAt` +30 days, notifies owner.
- `GET /owners`, `GET /owners/:id`; `GET /stats` (KPIs: restaurants, orders, revenue, churn, MRR, 12-month growth); `GET /revenue` (by plan, MRR chart, upcoming renewals).
- `GET /support-tickets` (CAMERA_ALERT notifications as tickets), `POST /support-tickets/:id/reply`, `PUT /support-tickets/:id/close`.
- `POST /broadcast` — bulk SMS (Africa's Talking) + email to all owners.

#### `ussd` (`/ussd`) — USSD ordering
- `POST /handler` — Africa's Talking USSD webhook. **Swahili state machine** with CON/END responses: `MAIN_MENU → CATEGORY_SELECTED → ITEM_SELECTED → CONFIRM_ORDER → PAYMENT → ORDER_PLACED`. Session in Redis (`ussd:session:{sessionId}`, 300s TTL). Creates **real orders** (orderNumber `USD{base36}`, PENDING/UNPAID). Responses truncated to 182 chars. Restaurant resolved via UssdSession table.

#### `sms` (`/sms`) — SMS ordering
- `POST /incoming` — Africa's Talking SMS webhook. Command parsing (EN + Swahili keywords): `MENU`/`1` → menu summary; `ORDER [item]`/`2` → item search + order creation (`SMS{base36}` number); `STATUS [n]`/`3` → order status; `HELP`/`0` → bilingual help. Language auto-detect via Swahili keyword dictionary. All messages logged (INBOUND/OUTBOUND). Always responds `{status:'ok'}`.

#### `notifications` (`/notifications`) — in-app notifications
- `GET /` — role-scoped (super_admin → PLATFORM_ADMIN; owner → OWNER; staff → STAFF).
- `GET /unread-count`, `PUT /:id/read`, `PUT /read-all`, `DELETE /:id` — with ownership checks.

### 7.4 Services (`backend/src/services/`)

- **`auth.service.ts`** — pure, dependency-injected auth logic (DB access via callbacks). Constants: access 7d / refresh 30d, OTP 6 digits/600s, max 5 login attempts / 15-min lockout. Functions: register, verifyOTP, login, refreshAccessToken (validates against Redis store, rotates), forgotPassword, resetPassword, staffLogin, logout, generateStaffPIN (bcrypt 10 rounds), changePassword (invalidates all refresh tokens).
- **`ai.service.ts`** — AI orchestration (own PrismaClient instance). `processCustomerMessage` — loads restaurant, ≤50 items, FAQs; upserts AiConversation (history trimmed to last 40); calls `openai.customerChat`; **falls back to a local rule-based `buildSmartReply`** ("chef fallback") when the LLM fails — handles item lookups, popular/best, specials, dietary filters, price, FAQ keyword intents (hours/payment/contact/location/delivery), small talk, jokes, weather, math, trivia. Also: processOwnerSetup (JSON mode), generateAndSaveImage, createDailySocialPosts, generateMenuDescriptions, analyzeFoodImage, getOrCreateConversation.
- **`mpesa.service.ts`** — M-Pesa orchestration with injected Order/Payment/Socket service interfaces. `initiatePayment` (per-restaurant credentials from RestaurantSettings with env fallback), `handleCallback` (idempotent; on success: payment completed, order PAID, emits `payment:completed` + `order:paid`, **SMSes both customer (receipt) and owner (notification)**; on failure: marks failed + bilingual SMS), `queryPendingPayments` (polls >2 min old), `handlePaymentFailure`, `initiateRefund` (B2C BusinessPayment).
- **`table.service.ts`** — `onTableSeated` (creates TableSession, emits OCCUPIED), `freeTableIfLastOrder` (frees table + ends sessions when no other active unpaid order exists).

### 7.5 Middleware (`backend/src/middleware/`)

- **`auth.ts`** — `authenticate` (Bearer access JWT → req.user; bilingual errors), `optionalAuth`, `verifyRefreshToken` (cookie `refreshToken`), `verifyStaffPin` (header `x-staff-pin`, format `^\d{4,6}$`).
- **`authorization.ts`** — `ROLE_HIERARCHY`: super_admin=100, owner=80, manager=60, cashier=40, waiter=30, kitchen=20, staff=10. `requireRole(...)` (hierarchy fallback: user level ≥ required), `requireOwnership` (compares restaurantId; super_admin bypass), `requireStaffRole`, `requireSelfOrAdmin`.
- **`multitenant.ts`** — `extractRestaurantId` (JWT → params → body → query), `validateAccess` (cross-restaurant access → 403 + warning log), **`enforceRestaurantScope`** — the main tenant guard: super_admin bypass; otherwise uses `req.user.restaurantId` and sets `req.restaurantId` for downstream queries.
- **`rateLimiter.ts`** — express-rate-limit (all skipped in test): `generalLimiter` 100/min, `authLimiter` 5/min, `aiChatLimiter` 30/min, `mpesaLimiter` 10/min, `orderCreateLimiter` 6/min. All throw bilingual `RateLimitError` (429).
- **`validate.ts`** — `validate(schema, {stripUnknown})` for body (default strips unknown keys), `validateQuery`, `validateParams` — all via Zod, 422 ValidationError.
- **`errorHandler.ts`** — ZodError → 422; AppError → its JSON; unknown → 500 (message hidden in prod, stack in dev); Sentry capture in prod tagged with requestId.
- **`audit.ts`** — `auditLog` wraps `res.json`: logs POST/PUT/PATCH/DELETE with auditId, method, path, statusCode, duration, userId, role, restaurantId, client info, sanitized body (redacts password/pin/token/otp/secret/authorization/creditCard/cvv). Sensitive paths flagged `sensitivity: 'high'`. Also `createAuditEntry(...)` for programmatic logging.

### 7.6 Utils (`backend/src/utils/`)

- **`cache.ts`** — `invalidateMenuCache(restaurantId)`: deletes `menu:{restaurantId}` + `menu:public:{slug}`.
- **`encryption.ts`** — AES-256-CBC encrypt/decrypt (key = SHA-256 of ENCRYPTION_KEY, IV prepended `iv:data`), bcrypt hash/compare (12 rounds), random token generator.
- **`errors.ts`** — `AppError` (statusCode, code, message, **messageSwahili**, toJSON) + factories and subclasses: badRequest(400), unauthorized(401), forbidden(403), notFound(404), conflict(409), validation(422), rateLimit(429), internal(500).
- **`helpers.ts`** — `generateOrderNumber` (`ORD-{last4}-{base36 ts}-{uuid4}`), `generateSlug`, `formatKES`, `calculateTotals` (VAT-inclusive: serviceCharge 5%, tax subtotal×16/116, total = subtotal + serviceCharge), `generatePin` (6-digit), `sanitizeHtml` (XSS regex), `chunkArray`, `asyncHandler`, `isValidUUID`, `maskPhone`, `maskEmail`, `parsePagination`, `buildPaginationMeta`.
- **`logger.ts`** — Winston: console + file transports (`logs/error.log` 5MB×5, `logs/combined.log` 5MB×10 in dev); auto requestId; JSON in prod, colorized in dev; `createRequestLogger`.
- **`validation.ts`** — ~40 Zod schemas across auth, restaurant, menu, tables/zones/promotions, staff, orders, payments, AI, admin, surveillance. Phone regex `^\+254[17]\d{8}$`; password policy (uppercase + lowercase + number, ≥8).

---

## 8. Frontend Deep Dive

### 8.1 Entry & bootstrap
- **`src/main.tsx`** — mounts App inside `StrictMode` → `ErrorBoundary` → `BrowserRouter`; imports i18n + index.css; installs a **chunk-reload guard**: on "Failed to fetch dynamically imported module" errors it forces one full page reload (sessionStorage-guarded) to recover from stale Vite chunks after deploys.
- **`src/App.tsx`** — `GoogleOAuthProvider` → `ThemeProvider` → `AppRoutes` + `Toaster`. `restoreSession()` on mount. All pages lazy-loaded with `Suspense` + `BrandLoader` fallback; framer-motion `PageTransition` wrapper; `AnimatePresence mode="wait"`. Full route map in §19.
- **`src/index.css`** — Tailwind v4 `@theme` tokens: brand colors (`--color-primary: #0A1628`, `--color-primary-light: #1A2A4A`, `--color-secondary: #FF6B35`, `--color-accent: #FFD700`, success #2ECC71, backgrounds #FAFAF7 / #060D1A), fonts (Playfair Display heading, Inter body, Space Grotesk accent). `:root` duplicates tokens as **runtime-themable CSS variables** + gradients (used by ThemeProvider). Utility classes: `.glass`, `.text-gradient`, `.grad-brand*`, `.shadow-soft`, `.shadow-warm`, animation utilities + keyframes (float, pulseGlow, wave, slideUp, shimmer, loadingDots, popIn, brandPulse, progressStripes). **RTL support**: `[dir="rtl"]` flips direction and borders.

### 8.2 Global store — `src/store/useStore.ts` (Zustand, ~990 lines)
One global store. Every async action wraps in try/catch + `toast.error`.

**Auth/session:** `isAuthenticated`, `userRole ('owner'|'admin')`, `accessToken`, `refreshToken`, `restaurant`. Actions: `login` (persists both tokens to localStorage, sets restaurant), `loginWithGoogle` (also stores `google_email`), `register` (tokens stored, NOT authenticated — OTP pending), `verifyOtp` (sets authenticated), `logout` (calls API best-effort, clears ALL localStorage + resets every data slice), `restoreSession` (reads tokens, optimistically authenticates, fetches restaurant via `restaurantApi.fetchRestaurant`, backfills `brandColor` from `settings.primaryColor`, on 401 clears session).

**Onboarding:** `onboarding` object (step 0–6, defaults: brandColor #FF6B35, fontStyle modern, layout grid, tables 10, qrStyle 0), `updateOnboarding`, `nextStep/prevStep`, `resetOnboarding`.

**Menu:** `categories`, `loadingCategories`; `fetchCategories` (normalizes server shape: `menuItems`→`items`, aliases photo/prepTime/available), `addCategory/updateCategory/removeCategory`, `addItem` (builds rich dietary payload), `updateItem/removeItem`, `toggleItemAvailability` (**optimistic with rollback**).

**Orders:** `orders`, `liveOrders`; `normalizeOrderStatus` maps server enums to `new|preparing|ready|served|cancelled`; `fetchOrders`, `fetchLiveOrders`, `updateOrderStatus` (updates both lists), `placeOrder` (public endpoint), `addOrder` (realtime insert).

**Tables/zones:** `tables`, `zones`; normalization (`tableNumber|number`, `positionX|position_x`, shape uppercased); full CRUD for tables + zones + `setTableStatus`.

**Payments:** `transactions`, `todaySummary`; normalization (method MPESA→mpesa etc., status PAID→confirmed, reference from mpesaReceiptNumber|mpesaTransactionId); `fetchPayments`, `fetchTodaySummary`, `initiateMpesa`, `recordCashPayment`.

**Staff, surveillance, notifications, QR codes, restaurant settings:** matching slices with CRUD actions; `addAlert` used by realtime.

**Customer:** `customer`, `cart` (`addToCart` increments qty by item id, `removeFromCart`, `updateCartQuantity`, `clearCart`), `language ('en'|'sw'|'ar')`.

### 8.3 API layer (`src/api/`)
- **`client.ts`** — axios instance, `baseURL = import.meta.env.VITE_API_URL || '/api/v1'`.
  - **Request interceptor:** attaches `Authorization: Bearer` using `localStorage['accessToken']` **or** `localStorage['staffAccessToken']` (one client for both auth contexts).
  - **Response interceptor (401 refresh flow):** on 401 (not retried) → bare `axios.post` to `/auth/refresh-token` with the stored refresh token (bypasses interceptor to avoid recursion) → stores new access token → retries original request. On failure, clears tokens.
- **`index.ts`** — barrel exporting `client`, `authApi`, `restaurantApi`, `menuApi`, `ordersApi`, `tablesApi`, `paymentsApi`, `staffApi`, `surveillanceApi`, `notificationsApi`, `aiApi`, `analyticsApi`. (`promotionsApi` and `qrcodesApi` are imported directly by pages.)
- **Per-module `unwrap` helper:** `r.data?.data || r.data`.

Key endpoint summaries (all under `/api/v1`):

| Module | Functions (→ endpoints) |
|---|---|
| `auth.ts` | login, loginWithGoogle, register, verifyOtp, resendOtp, logout, refreshToken, forgotPassword (email/phone auto-detect), resetPassword, staffLogin(pin, slug) |
| `restaurant.ts` | fetchRestaurant (GET /restaurant/me), updateRestaurant, uploadImage (dataUrl), updateSettings, get/updateOpeningHours, getBranches/createBranch |
| `menu.ts` | category + item CRUD, bulkUpdateItems, duplicateItem, reorderCategories/reorderItems, toggleItemAvailability, getPublicMenu(slug), searchPublicMenu |
| `orders.ts` | fetchOrders, fetchLiveOrders, getOrder, updateOrderStatus (lowercases status), assignWaiter, cancelOrder, getOrderHistory, getKitchenOrders, placeOrder (public), getOrderStatus (public), createPosOrder (source 'POS'), addOrderNote, refundOrder |
| `payments.ts` | fetchPayments, fetchReceipts, getPayment, fetchTodaySummary, initiateMpesa, getMpesaStatus, recordCashPayment, openShift/closeShift/getShifts, recordCardPayment, recordTip, recordServiceCharge, voidPayment, getRevenueReport, getTaxReport |
| `analytics.ts` | overview, revenue, orders, menu-items, tables, scans, search-terms, ai-questions, social (all GET) |
| `promotions.ts` | CRUD via /restaurant/me/promotions |
| `qrcodes.ts` | CRUD + generate, generateBatch, downloadQrPng, downloadQrPdf |
| `staff.ts` | CRUD + resetStaffPin |
| `surveillance.ts` | cameras CRUD, testCameraConnection, getStreamToken, getAlerts, getCameraAlerts, reviewAlert |
| `tables.ts` | tables CRUD, setTableStatus, updateTableSession (START/END), zones CRUD |
| `ai.ts` | customerChat, generateDescription (multi-option), generateRestaurantDescription, generateImage, enhanceImage, generateFaq, generateSocialPost |

### 8.4 Types (`src/types/index.ts`)
Key shapes: `Restaurant` (with nested `settings`), `MenuCategory`/`MenuItem` (dietary flags + localized fields), `Order`/`OrderItem` (normalized lowercase statuses), `Customer`, `Staff`, `AiMessage`, `TableInfo`, `TableStatus`/`TableShape`, `FloorZone`, `FloorTable` (floor-plan geometry + sessions + qrCode), `Transaction`, `Post`, `Alert`, `Camera`, `CartItem`, `OnboardingData`.

### 8.5 i18n (`src/i18n/`)
i18next + browser language detector. **3 languages**: en (~8.8 KB), sw (~9.4 KB), ar (~11.5 KB) — static JSON imports. Initial: `localStorage['app-language'] || 'en'`; detector `['localStorage', 'navigator']`; fallback `en`. RTL handled by `[dir="rtl"]` CSS and explicit `document.dir` toggling in SettingsPage/DashboardLayout. Many customer components use inline `t()` helper maps rather than i18next keys.

### 8.6 Theming
- **`components/theme/ThemeProvider.tsx`** — context exposing `{theme, updateTheme, applyTheme, generatePalette}`. `generateColorPalette(baseColor)` computes luminance to pick lighter/darker accents and returns a full CSS-variable map; `googleFonts` = 21 font families with prebuilt `GOOGLE_FONTS_URL`. Hydrates from `localStorage['app-theme']`, syncs dark mode from store, applies CSS variables to `document.documentElement`, toggles `.dark` class, injects Google Fonts `<link>`. Restaurant settings can drive the theme (elegant→Playfair, classic→Merriweather).
- **`hooks/useRestaurantTheme.ts`** — fetches the public menu for a slug and transiently applies the restaurant's brand theme; used by staff pages via `localStorage['staffRestaurantSlug']`.

### 8.7 Pages (`src/pages/`) — functional overview
- **Landing (`/`)**: Navbar, Hero, SocialProof, Features, HowItWorks, Pricing, Testimonials, Footer + floating `ChefAIAssistant` chatbot (rule-based, ~16 intents: pricing "KES 5,000 setup + 5% commission capped at KES 10,000/mo", features, M-Pesa, QR, staff, security).
- **Demo (`/demo`)**: interactive demo fetching the **real** public menu of `bahari-restaurant` (the seeded demo restaurant), live QR code, cart simulation, live AIChat.
- **Auth**: `LoginPage` (owner/staff tabs; owner = email/password + Google OAuth + demo autofill; staff = PIN + slug, routes to role dashboard; stores `staffAccessToken`/`staffRole`/`staffName` in localStorage), `SignUpPage` (2-step: form → OTP entry with auto-advance/paste/resend; → `/onboarding/welcome`), `ForgotPasswordPage`, `StaffLoginPage`.
- **Customer menu (`/menu/:restaurantSlug`)**: `MenuView` (menu from `getPublicMenu`, sticky category pills, announcement banner, promotions carousel, item cards, "Track Order" via `sessionStorage['activeOrder_<slug>']` valid 2h, embedded AIChat, theme applied), `MenuCart` (cart, takeaway identity, payment modal M-Pesa/cash, places order, stores activeOrder), `MenuOrderStatus` (4-step tracker, polls every 10s). `RestaurantMenu`/`CartPage`/`OrderTrackingPage` are a **legacy/unrouted** component stack.
- **Onboarding** (`/onboarding/*`): Welcome → Profile → Menu → Appearance → AiSetup → QR (QR style 0–3, 1–50 tables, finish → `/dashboard`). A richer `OnboardingWizard` component (6 steps, Chef-AI chat-driven, confetti QR) exists but is **not wired into the router**.
- **Dashboard (owner, `/dashboard`)**: `DashboardHome` (stat cards, recent orders, 60s auto-refresh), `MenuManager` (full menu CRUD, drag-reorder, bulk delete, AI description generation with 3 options, dietary flags, localized fields), `TablesPage` (floor-plan editor: drag/resize tables & zones, shapes, rotation, bulk add 50, status legend), `OrdersPage` (Live Kanban / History / Kitchen tabs, 15s refresh), `PaymentsPage` (stat cards, live transactions, M-Pesa vs cash donut, hourly chart, cash reconciliation panel), `AnalyticsPage` (period toggle, 6 metric cards, revenue/orders/scans charts, top items, payment donut, traffic sources; `Promise.allSettled` of 5 endpoints), `SurveillancePage` (camera grid, webcam preview, add-camera with connection test, fullscreen, alerts feed), `SettingsPage` (9 sections: Profile with ETR compliance fields, Appearance with live preview, QR Manager, Staff HR forms, Notifications toggles, Payment Settings incl. M-Pesa products, Language, Subscription, Delete Account), `HelpPage` (FAQ accordion, YouTube tutorials, support contact, mock Chef AI).
- **Staff**: `KitchenDisplay` (`/staff/kitchen` — KDS cards, timers, Start→Ready→Served), `CashierDashboard` (`/staff/cashier` — **full POS**: order list w/ filters + urgency borders after 15/30 min, payment panel with discount/tip/service-charge, NumberPad, split/void/notes/hold modals, quick order creation, floor-plan mode, receipts browser, **80mm thermal receipt printing** with ETR-format serials + VAT layout, shift open/close, "ka-ching" sound, customer display mode), `WaiterDashboard` (`/staff/waiter` — active/served tabs + floor plan, mark served, complaints/refunds, free-table, 15s polling), `StaffProfile`.
- **Admin (`/admin`)**: `AdminOverview`, `AdminRestaurants`, `AdminSubscriptions`, `AdminSupport`, `AdminSettings` — **all use client-side mock data** (no real API calls).

### 8.8 Key components
- **customer/**: `AIChat` (floating chef-hat chat; session in `sessionStorage['chefSession_<restaurantId>']`; renders reply + suggested items as purchasable cards with Add to Cart + quick replies), `CartPage`, `MPesaPayment` (animated simulated STK flow with confetti; real push happens via `paymentsApi.initiateMpesa`), `OrderTracking`, `MenuHeader` (parallax, brand colors, Halal/Open-Now pills, sticky shrink, wave divider), `CategoryTabs` (animated layoutId pills, scroll-into-view), `MenuItemCard` (grid/list, ribbons, dietary icons, sold-out overlay, animated add-to-cart), `ItemDetailSheet` (bottom sheet: allergens, prep time, instructions, qty), `SearchFilter` (search + dietary chips + dual price sliders + availability toggle), `LanguageToggle`, `LoadingScreen`.
- **floor/FloorCanvas.tsx** — the floor-plan engine shared by TablesPage (edit) and cashier/waiter (view). Unit 24px, canvas 1100×700, zoom 0.4–1.6 fit-to-screen. `ordersAtTable(table, orders)` derives per-table state; `resolveTableStatus` priority: UNAVAILABLE → RESERVED → READY-unpaid (green pulse) → PREPARING/NEW (amber) → CONFIRMED (purple) → OCCUPIED → settled → FREE. Pointer-event drag system with optimistic drafts, corner resize handles, zone-drawing mode, rotation rendering.
- **pos/**: `NumberPad` (touch-friendly), `TableGridView`.
- **onboarding/OnboardingWizard.tsx** — 6-step wizard (unwired) with animated stepper, AI chat-driven profile step, FAQ presets, QR generation with branded PNG download/print/share + confetti.
- **layout/**: `DashboardLayout` (sidebar + topbar with NotificationBell, **15s notification polling** with browser-style toasts, Arabic dir), `DashboardSidebar`, `AdminLayout`/`AdminSidebar`/`AdminHeader`, `ProtectedRoute` (staff = `staffAccessToken` check; otherwise `isAuthenticated` + `userRole` match), `NotFound`.
- **notifications/NotificationBell.tsx** — unread badge (9+ cap), 30s polling, per-type icons, mark-all-read.
- **ui/** — design system: Button, Input, Textarea, Select, Toggle, Badge, Avatar, Card, Modal, BottomSheet, Skeleton, ProgressBar, StatusTracker, EmptyState, SearchBar, RefreshButton, FloatingCart, BrandLoader, Toast wrappers, QRCode (canvas + PNG download).
- **ErrorBoundary.tsx** — class boundary with chunk-load auto-reload + fallback UI.

---

## 9. Authentication & Authorization

### 9.1 Two parallel auth contexts
1. **Owner/platform:** access (7d) + refresh (30d) JWTs stored in localStorage (`accessToken`/`refreshToken`). `isAuthenticated` + `userRole` in the Zustand store. Refresh rotation via the axios 401 interceptor.
2. **Staff:** PIN-based login (`/auth/staff/login`) storing `staffAccessToken`, `staffRefreshToken`, `staffRole`, `staffName`, `staffId`, `staffRestaurantSlug` in localStorage. Guarded by `ProtectedRoute requiredRole="staff"`.

Both share the same axios client — the request interceptor picks whichever token exists.

### 9.2 Roles & hierarchy (backend)
`super_admin (100) > owner (80) > manager (60) > cashier (40) > waiter (30) > kitchen (20) > staff (10)`. `requireRole` supports hierarchy fallback (a manager passes a waiter check), special forms (`'admin'`→super_admin, `'base+extra'`), `requireStaffRole`, and `requireOwnership` for resource-level checks.

### 9.3 Tenant isolation
`enforceRestaurantScope` middleware derives the restaurant from the JWT and sets `req.restaurantId`; all queries filter by it; super_admin bypasses; cross-tenant access → 403. QR stream tokens are separate 2h signed JWTs.

### 9.4 Session protection
Login brute-force lockout (Redis, 5 attempts / 15 min), refresh-token rotation + Redis-store validation, OTPs for registration/verification/password reset (Redis, 600s TTL), password policy (≥8 chars, upper+lower+number), staff PINs bcrypt-hashed, and per-endpoint rate limits.

---

## 10. Realtime Strategy (Socket.io & Polling)

**Socket.io** (`backend/src/hooks/socket.ts`):
- CORS from `FRONTEND_URL`, ping 25s/20s, transports websocket+polling. Auth via handshake token (access JWT); anonymous sockets allowed. Optional Redis adapter for multi-instance scale-out.
- **Rooms:** `restaurant:{id}`, `order:{id}` (routes use order *number*), `admin:global`.
- Client events: `join:restaurant`, `join:order`, `order:status-update` (role-gated, log-only), `disconnect`.
- Server-emitted helpers: `order:new`, `order:status-changed`, `payment:confirmed`, `table:status-changed`, `camera:alert`, `notification:new`.

**Frontend reality check:** the customer-facing pages do not currently subscribe to sockets — all "realtime" behavior is achieved with **polling loops** (DashboardHome 60s, OrdersPage 15s, KitchenDisplay 15s, CashierDashboard 15s, WaiterDashboard 15s, NotificationBell 30s, MenuOrderStatus 10s). The socket layer exists on the backend and is ready for future realtime adoption.

---

## 11. Payments: M-Pesa Flow

**Design principle: money goes directly to the restaurant's own till/paybill — MenuMoja never handles funds.**

1. **Initiation** — `POST /payments/mpesa/initiate` (rate-limited 10/min). Validates the order (not paid/cancelled), blocks duplicates (5-min window), normalizes phone (`0`→`254`, `+` stripped), validates `^254[17]\d{8}$`, saves the phone on the order, calls `mpesaService.initiatePayment`.
2. **STK push** — `mpesa.stkPush(...)` uses **per-restaurant credentials** (shortcode/passkey/business name from `RestaurantSettings`) with env fallback (`MPESA_SHORTCODE` default 174379). TransactionType `CustomerPayBillOnline`, amount 1–150,000 KES, AccountReference ≤12 chars, TransactionDesc ≤13 chars. OAuth access token cached in Redis (`mpesa:access_token`, TTL minus 60s). 3× retry with exponential backoff. Sets idempotency key `mpesa:idempotency:{CheckoutRequestID}` (24h). A PENDING Payment row is recorded.
3. **Customer** enters their M-Pesa PIN on their phone and confirms.
4. **Callback** — Safaricom hits `POST /payments/mpesa/callback`. In production, the client IP must be in Safaricom's CIDR whitelist; the body must match `stkCallback` structure. **Idempotency:** Redis key checked before processing. Responds in Safaricom's format `{ResultCode: 0, ResultDesc: "Success"}`.
5. **Handling** — on success: payment → PAID (receipt number stored), order → PAID, emits `payment:completed` (order room) + `order:paid` (restaurant room), **SMSes the customer a receipt and the owner a notification** (Africa's Talking), table freed if it was the last unpaid order. On failure: payment → failed, order → payment_failed, bilingual SMS to customer.
6. **Polling** — `mpesaService.queryPendingPayments` resolves payments stuck PENDING for >2 min by live-querying Safaricom.
7. **Refunds** — cancelling a PAID M-Pesa order auto-initiates a **B2C payment** (`/mpesa/b2c/v1/paymentrequest`, BusinessPayment) requiring `MPESA_INITIATOR_NAME` + `MPESA_SECURITY_CREDENTIAL`; payment → refunded, order → refunded.
8. **Sandbox** — `MPESA_ENV !== 'sandbox'` switches base URL; test number `254708374149`.

Cash flow: `POST /payments/cash/record` computes change, records cashierId, increments the open cash shift's expected cash, emits `payment:recorded`.

---

## 12. Integrations Catalog (`backend/src/integrations/`)

| Integration | File | What it does |
|---|---|---|
| **Safaricom Daraja (M-Pesa)** | `mpesa.ts` | OAuth token (Redis-cached), STK push, status query, C2B simulate, B2C refunds, URL registration, callback validation + idempotency |
| **Africa's Talking** | `africasTalking.ts` | SMS send/bulk/OTP; USSD state machine (English variant; the route implements its own Swahili one) |
| **Cloudinary** | `cloudinary.ts` | Image upload (buffer/URL) to `menumoja/{folder}`, thumbnails (400×400), multiple uploads (allSettled), delete, signed URLs, enhance (auto_brightness), watermarking |
| **Resend** | `email.ts` | Transactional email: welcome, order receipt (itemized), payment confirmation, password reset, subscription warnings; branded HTML templates |
| **Google Maps** | `googleMaps.ts` | Geocode, reverse geocode, place autocomplete (restricted to Kenya), place details, distance matrix |
| **HuggingFace** | `huggingface.ts` | Image generation (FLUX.1-dev, SD 3.5, SDXL, openjourney with fallbacks), video (HunyuanVideo), model listing |
| **Meta Graph API** | `meta.ts` | FB/IG posting, scheduling, insights, token exchange/refresh, page/business info |
| **OpenAI / DeepSeek** | `openai.ts` | Chef-assistant chat (context-bound system prompt), owner-setup chat (JSON mode), menu description generation (EN+SW, seeded variations), restaurant descriptions, DALL-E 3 images, camera image analysis (vision), social posts, FAQ suggestions, streaming variant |
| **WhatsApp Cloud API** | `whatsapp.ts` | Template/text/image/interactive/list messages, OTP, order confirmations, webhook parsing, token verification |

---

## 13. Background Jobs & Scheduling (`backend/src/jobs/`)

- **`queue.ts`** — BullMQ queues created **only when Redis is available** (non-local URL); otherwise `createNullQueue` no-op stubs (dev/test safe). Queues: `email`, `sms`, `social-media`, `analytics`, `mpesa`, `camera`, `cleanup`. Defaults: 3 attempts, exponential backoff 2s, cleanup of completed (1d/100) and failed (7d/500) jobs. Helpers: `addEmailJob`, `addSmsJob`, `addSocialMediaJob`, `addAnalyticsJob`, `addMpesaJob`, `addCameraJob`, `addCleanupJob`, `getQueue`, `pauseAllQueues`/`resumeAllQueues`.
- **`scheduler.ts`** — `initializeScheduler()` instantiates the same queues for repeatable jobs (called at server start).
- **`workers.ts`** — `startWorkers()` registers workers (concurrency: email=5, sms=10, social-media=3, analytics=1, mpesa=2, camera=2, cleanup=1) — **currently log-only stubs**; real processing logic is not implemented here (caveat §20).

---

## 14. Security Measures

- **Helmet** with custom CSP (allows only needed origins: Safaricom, DeepSeek, HuggingFace, Cloudinary, YouTube, Google Fonts; blocks objects; upgrades insecure requests) + cross-origin resource policy.
- **CORS** restricted to `FRONTEND_URL` (+ localhost:5173 in dev), credentials allowed.
- **Rate limiting** on every layer (general 100/min, auth 5/min, AI chat 30/min, M-Pesa 10/min, order create 6/min).
- **JWT** access/refresh with Redis-backed rotation + store validation; production startup guard on secrets.
- **bcrypt** (10–12 rounds) for passwords and staff PINs.
- **AES-256-CBC encryption** for camera passwords (`ENCRYPTION_KEY`).
- **M-Pesa callback IP whitelisting** + Redis idempotency keys.
- **Anti-spam honeypot** on public order creation + duplicate-order guard + max 3 active orders/session.
- **Audit logging** for all state-changing owner/POS routes with sensitive-field redaction.
- **XSS defenses:** `sanitizeHtml` server-side, `sanitizeInput` client-side, strict CSP.
- **Tenant isolation** via `enforceRestaurantScope`.
- **Production error messages hidden** (500s return generic message; stack only in dev).
- **Sentry** for error tracking (optional DSN).

---

## 15. Error Handling & API Conventions

**Uniform API envelope:**
```json
{ "success": true, "data": { ... }, "meta": { "total": 0, "page": 1, "perPage": 50 } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "messageSwahili": "..." } }
```
- Every error carries a **Swahili translation** (`messageSwahili`).
- HTTP codes: 400 badRequest, 401 unauthorized, 403 forbidden, 404 notFound, 409 conflict, 422 validation, 429 rateLimit, 500 internal.
- The 404 fallback and all error responses follow the envelope; the health endpoint and M-Pesa callback (Safaricom format) are deliberate exceptions.
- Frontend `unwrap` helper + store-level toast errors (`err?.response?.data?.message || fallback`).

---

## 16. Testing

**Backend (Jest + supertest, `backend/tests/`):**

| File | Coverage |
|---|---|
| `auth.test.ts` | register (201/409), login (200/401/429 lockout), refresh-token, staff PIN login (200/401) |
| `menu.test.ts` | categories CRUD, items CRUD + toggle, public menu (200/404) |
| `orders.test.ts` | public create (201/422), public status, live list, status transitions (valid/invalid), CSV export |
| `payments.test.ts` | M-Pesa initiate, cash record + change, today summary totals, shift open/close with discrepancy flag |
| `restaurant.test.ts` | profile get/update, settings update, tables list/create/delete |
| `analytics.test.ts` | overview metrics, revenue grouping |
| `security.test.ts` | **Security suite (20 tests, added 2026-08-12):** invalid/expired/refresh-as-access tokens, cross-tenant scoping (asserts `where.restaurantId`), suspended-restaurant block, RBAC kitchen escalation, malformed payloads, anti-spam honeypot, POS idempotency (duplicate key → same order / different keys → different orders), M-Pesa webhook idempotency (duplicate callback never reprocessed, failure reported to Safaricom), brute-force lockout |

`helpers.ts` mocks Prisma, Redis, config, sockets, and services; builds a real Express app with the real error handler; generates test JWTs; provides fixture builders. Test pattern: unit/integration hybrid — real routes, mocked infrastructure.

**Status (2026-08-12): 7 suites / 55 tests passing.** The suite was previously **broken** (could not start — `jest.config.ts` required uninstalled `ts-node`; stale mocks, harness route-mount order bug, dummy bcrypt hashes). Repairs: `jest.config.js` (CommonJS, ts-jest `isolatedModules`, `maxWorkers: 2`, `workerIdleMemoryLimit: 768MB`), harness imports individual routers (not the barrel, which pulled in the AI/OpenAI graph), real bcrypt fixtures, correct mount order. Production fixes surfaced by tests: infinite slug-uniqueness loop guard (restaurant PUT /me) and lazy Cloudinary import in `restaurant.routes.ts`.

**Frontend:** no test suite configured (no vitest/jest deps). Verification is via `npm run build` (tsc -b + vite build) and `npm run lint` (now clean: 0 errors, 698 tracked warnings — config demoted pervasive debt rules, fixed 13 real errors; see `MENU_MOJA_AUDIT.md` §"PHASE 0 EXECUTION STATUS").

---

## 17. Environment Variables

### 17.1 Frontend (`.env.example`)
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL. Empty in dev (Vite proxy → localhost:3001). Production example: `https://menumoja-backend.onrender.com/api/v1` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth |
| (`VITE_MPESA_CONSUMER_KEY/SECRET`, `VITE_MPESA_PASSKEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SENTRY_DSN`, `VITE_APP_ENV` — present in local `.env`) |

### 17.2 Backend (`backend/.env.example`) — names only
| Category | Variables |
|---|---|
| Database | `DATABASE_URL`, `REDIS_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` (aes-256-cbc) |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| AI | `AI_PROVIDER` (deepseek), `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (deepseek-v4-flash), `OPENAI_API_KEY` |
| M-Pesa | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` (174379), `MPESA_CALLBACK_URL`, `MPESA_ENV`, `MPESA_INITIATOR_NAME`, `MPESA_SECURITY_CREDENTIAL` |
| Africa's Talking | `AT_API_KEY`, `AT_USERNAME`, `AT_USSD_CODE`, `AT_SENDER_ID` |
| Meta/WhatsApp | `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` |
| Google | `GOOGLE_MAPS_API_KEY`, `GOOGLE_CLIENT_ID` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Monitoring | `SENTRY_DSN` |
| App | `NODE_ENV`, `PORT` (3001), `FRONTEND_URL`, `API_URL`, `ADMIN_EMAIL` |

---

## 18. Deployment & Infrastructure

### 18.1 Topology
```
Vercel (menumoja.vercel.app)          Render / Railway (menumoja.onrender.com)
  Vite SPA (dist/)          ──/api/v1 rewrite──▶  Express backend (Docker, port 3001)
                                                       │
                            PostgreSQL (Supabase/managed) ◀── Prisma
                            Redis (Render managed) ◀── tokens/OTP/cache/queues
GitHub Actions keep-awake.yml ── pings /api/v1/health every 10 min (free-tier spin-down)
```

### 18.2 Configs
- **`render.yaml`** — blueprint: web service `menumoja-backend` (Docker, `backend/Dockerfile`, branch `main`, health check `/api/v1/health`, env: NODE_ENV=production, PORT=3001, FRONTEND_URL, API_URL, REDIS_URL from service; DATABASE_URL + secrets set manually `sync:false`) + managed Redis service (`noeviction`).
- **`vercel.json`** — `framework: vite`, build `npm run build`, output `dist`; rewrites: `/api/v1/(.*)` → `https://menumoja.onrender.com/api/v1/$1`; `/(.*)` → `/index.html` (SPA fallback); `/assets/*` immutable 1-year caching.
- **`railway.json`** — Dockerfile build (`backend/Dockerfile`), healthcheck path, restart on failure.
- **`backend/Dockerfile`** — node:22-alpine, `npm ci`, `prisma generate`, exposes 3001, HEALTHCHECK every 30s against `/api/v1/health`, CMD `sh scripts/start.sh`.
- **`backend/scripts/start.sh`** — `prisma migrate deploy` (schema migrations), conditional seed (seeds only if `owners` table is empty), then runs the app with `tsx` (no compile step).
- **`.github/workflows/keep-awake.yml`** — cron `*/10 * * * *` ping to keep the free-tier backend warm.
- **`.github/workflows/ci.yml`** — CI (added 2026-08-12): backend (install, prisma generate, `tsc --noEmit`, `npm test`) + frontend (install, `npm run lint`, `npm run build`), on push/PR.

### 18.3 Local development
1. Backend: `cd backend && npm install && npm run dev` (tsx watch, port 3001) — requires `backend/.env` (DATABASE_URL etc.).
2. Frontend: `npm install && npm run dev` — Vite proxy sends `/api/v1` → localhost:3001; `VITE_API_URL` left empty.
3. DB: `npm run db:push` / `db:migrate` / `db:seed` (in backend). Schema changes: edit `schema.prisma`, then create a migration (`npx prisma migrate dev --name <name>` or hand-write SQL in `prisma/migrations/`) — never `db push` against production.

### 18.4 Deployment notes from `docs/SETUP_SCENARIOS.md`
Two production scenarios: (1) shared cloud (Supabase Pro + Render/Railway backend + Vercel frontend, ~KES 4,200–7,700/mo total); (2) per-client dedicated VPS (Hetzner/DigitalOcean, docker-compose with postgres:16 + backend + frontend + Caddy auto-HTTPS, nightly pg_dump backups).

---

## 19. Frontend Routing Map

| Path | Page | Guard |
|---|---|---|
| `/` | LandingPage | — |
| `/login`, `/signup`, `/forgot-password`, `/demo` | auth / demo | — |
| `/menu/:restaurantSlug` | MenuView (QR menu) | — |
| `/menu/:restaurantSlug/cart` | MenuCart | — |
| `/menu/:restaurantSlug/order/:id` | MenuOrderStatus | — |
| `/onboarding/welcome → profile → menu → appearance → ai-setup → qr` | onboarding steps | — |
| `/staff/login` | StaffLoginPage | — |
| `/staff/kitchen`, `/staff/cashier`, `/staff/waiter`, `/staff/profile` | staff screens | staff |
| `/dashboard` (+ tables, menu, promotions, orders, payments, analytics, surveillance, settings, help) | owner dashboard | owner |
| `/admin` (+ restaurants, subscriptions, support, settings) | admin panel | admin |
| `*` | NotFound | — |

---

## 20. Known Caveats & Technical Debt

1. **README.md is the default Vite template** — doesn't describe MenuMoja (this document fills that gap).
2. **PWA declared but disabled** — `vite-plugin-pwa` is a dependency but not configured; `index.html` deliberately unregisters service workers and clears caches (app runs as a regular SPA).
3. **Two Dockerfiles** — root `Dockerfile` and `backend/Dockerfile`; deployment configs use `backend/Dockerfile` (root one is legacy/duplicate).
4. **Two parallel customer menu stacks** — routed `MenuView/MenuCart/MenuOrderStatus` (server-driven) and unrouted component stack `RestaurantMenu/CartPage/OrderTrackingPage` (store-driven). Only the routed one is live.
5. **`OnboardingWizard` component is unwired** — the routed onboarding uses simple pages.
6. **Socket.io backend exists but frontend uses polling** — no current client socket subscriptions; all realtime is 10–60s polling.
7. **BullMQ workers are log-only stubs** — queues and schedulers exist, but job processors don't do real work.
8. **Duplicate USSD state machines** — `africasTalking.ts` has an English one; `ussd.routes.ts` has its own Swahili one (the route is canonical).
9. **`ai.service.ts` instantiates its own PrismaClient** instead of the shared singleton.
10. **Admin panel is fully mock** — AdminOverview/Restaurants/Subscriptions/Support/Settings use hardcoded client-side data (the backend admin API exists but isn't consumed).
11. **Missing asset** — `index.html` references `/icons/icon-192x192.png` (apple-touch-icon) which doesn't exist in `public/`.
12. ~~**Schema drift strategy** — production uses `prisma db push --accept-data-loss`~~ ✅ **FIXED 2026-08-12** — migrations in `backend/prisma/migrations/`, applied via `migrate deploy`.
13. **Non-strict backend TypeScript** — `backend/tsconfig.json` has all strict flags off.
14. **Root `.env` contains real-looking credentials** (M-Pesa consumer key/secret, Google client ID) — ignored by git but sensitive; rotate before sharing.
15. **`MpesaPayment` frontend component is a simulation** — real payments go through `paymentsApi.initiateMpesa`; the animated flow in some components is mock.
16. **HelpPage tutorials and ChefAIAssistant intents are hardcoded** (including the landing pricing numbers).
17. **No frontend tests** — only `npm run lint` / `npm run build` as verification. Backend has 7 suites / 55 tests (2026-08-12).
18. **Backend `dist/` and `logs/` are present in the working tree** (build artifacts/logs), plus root `tsconfig.tsbuildinfo`.
19. **`vite-plugin-pwa` version ^1.3.0 is listed but unused** (same as #2).
20. **Legacy `RestaurantMenu.tsx` / `CartPage.tsx` / `OrderTrackingPage.tsx`** pages in `src/pages/menu/` are not routed.
21. **POS order idempotency** ✅ implemented (2026-08-12) — `Idempotency-Key` header + DB unique constraint + Redis fast-path; see `backend/src/utils/idempotency.ts`.
22. **Central receipt service** ✅ implemented (2026-08-12) — receipts auto-generated on cash/card/M-Pesa payment with server-side numbers; client-side `genReceiptNo()` remains only as a fallback.
23. **Audit persistence** ✅ implemented (2026-08-12) — `AuditLog` model + write-through middleware; readable by super-admins via `GET /admin/audit-logs`.
24. **Lint baseline** — the ESLint config (2026-08-12) demotes pervasive debt rules (`no-explicit-any`, `no-unused-vars`) and new React-Hooks v7 rules to warnings; 698 warnings tracked, 0 errors. A dedicated cleanup phase should tighten these back to errors.

---

*Document generated from full source analysis — schema, routes, services, middleware, frontend store/API/pages, infra configs, and business docs. Last verified against `git` HEAD `7b3df9c` ("fix: order tracking steps + smooth floor-plan dragging", branch `main`).*
