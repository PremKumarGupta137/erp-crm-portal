# Mini ERP + CRM Operations Portal

An internal operations portal for a wholesale/distribution business. Sales, warehouse and
accounts teams share one system for customers, stock and dispatch documents — with every
stock change written to an auditable ledger.

Built for the Full Stack Developer case study.

| | |
|---|---|
| **Live frontend** | _fill in after deploy_ |
| **Live API** | _fill in after deploy_ |
| **Repository** | _fill in_ |
| **Postman collection** | [`docs/ERP-CRM.postman_collection.json`](docs/ERP-CRM.postman_collection.json) |

---

## Test credentials

All four roles are seeded. Password rules are deliberately simple for review purposes.

| Role | Email | Password | What it can do |
|---|---|---|---|
| Admin | `admin@erpcrm.com` | `Admin@123` | Everything, plus user management |
| Sales | `sales@erpcrm.com` | `Sales@123` | Customers, follow-ups, create/confirm challans |
| Warehouse | `warehouse@erpcrm.com` | `Warehouse@123` | Products, stock adjustments, confirm/cancel challans |
| Accounts | `accounts@erpcrm.com` | `Accounts@123` | Read-only across all modules |

The login screen lists these with a one-click fill button.

---

## Tech stack

**Backend** — Node.js · TypeScript · Express · Prisma ORM · PostgreSQL · Zod · JWT · bcrypt
**Frontend** — React 18 · TypeScript · Vite · React Router · hand-written CSS design system
**Infrastructure** — Neon (Postgres) · Render (API) · Vercel (static frontend)

No UI component library is used. The stylesheet is a small token-based design system
(`client/src/styles.css`) so the visual language stays consistent without shipping a
framework the reviewer has to trust.

---

## Architecture

```
┌────────────────────┐        HTTPS + JWT        ┌────────────────────┐
│   React SPA        │ ────────────────────────► │   Express REST API │
│   (Vercel)         │ ◄──────────────────────── │   (Render)         │
└────────────────────┘      JSON envelopes       └─────────┬──────────┘
                                                           │ Prisma
                                                           ▼
                                                 ┌────────────────────┐
                                                 │  PostgreSQL (Neon) │
                                                 └────────────────────┘
```

### Request pipeline

Every route passes through the same chain, so behaviour is uniform across modules:

```
helmet → cors → json body parser → morgan
       → authenticate (JWT)  → requireRole(...)  → validate(zodSchema)  → handler
       → notFoundHandler → errorHandler
```

- **`authenticate`** verifies the Bearer token and attaches `req.user`.
- **`requireRole`** gates by role. `ADMIN` implicitly passes every gate.
- **`validate`** parses with Zod and *replaces* the request segment, so handlers receive
  coerced, correctly typed values (dates as `Date`, numbers as `number`).
- **`errorHandler`** is the single place that turns anything thrown into JSON. Prisma's
  `P2002` / `P2025` / `P2003` are translated to 409 / 404 / 409 with readable messages;
  anything unrecognised becomes a 500 that never leaks internals in production.

### Response shape

Success:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 10, "total": 8, "totalPages": 1 } }
```

Failure:

```json
{
  "success": false,
  "message": "Insufficient stock for Detergent Powder 2kg (CLN-DET-2KG). Available: 18, required: 518",
  "code": "UNPROCESSABLE_ENTITY",
  "details": { "productId": "…", "available": 18, "required": 518 }
}
```

`details` carries per-field messages for validation failures, so the frontend renders
field-level errors without duplicating the rules.

---

## Data model and the three decisions worth explaining

### 1. Sales challans store a snapshot, not just a foreign key

`ChallanItem` copies `productName`, `productSku`, `category` and `unitPrice` at the moment
the challan is created. The `productId` FK is kept alongside for reporting joins, but the
document itself never changes.

Without this, renaming a product or revising a price would silently rewrite every historical
dispatch note — which is unacceptable for a document a customer signed. The same applies to
`SalesChallan.customerSnapshot`, which freezes the billing name, GST number and address.

There is a test for exactly this: rename a product in the catalogue, reload the challan, and
the old name is still on the document.

### 2. Stock is derived from a ledger, never edited directly

There is no "set stock to N" endpoint. Every change — opening stock, a manual correction, a
challan confirmation, a cancellation — writes a `StockMovement` row recording quantity,
direction, reason, the user, and a reference back to the document that caused it.

`Product.currentStock` is a running balance maintained in the same transaction as the ledger
row, so it is always reproducible by replaying the ledger. That is what makes the warehouse
able to answer "why is this number 13?".

### 3. Stock reduction is atomic and validated up front

Confirming a challan:

1. loads every referenced product in **one** query,
2. checks all lines against available stock,
3. throws `422` naming the specific product and shortfall if any line is short,
4. otherwise decrements balances and writes the `OUT` ledger rows.

All four steps run inside one `prisma.$transaction`. If line 3 of 5 is short, nothing at all
is written — no half-shipped document, and stock can never go negative.

Challan numbers (`CHL-2026-0001`) come from an atomic `Counter` row incremented **inside the
same transaction**, so Postgres holds a row lock for its duration and two concurrent users
cannot be issued the same number.

> **Note on transaction timeouts.** Prisma's default interactive-transaction budget is 5
> seconds. Against a managed Postgres in another region, a naive per-item loop (one query
> per line) blows through that and fails with `Transaction not found`. The helpers batch
> reads into a single `findMany` and writes into a single `createMany`, and the budget is
> raised to 30s as a safety margin. This was found by a smoke test, not in production.

---

## API reference

Base path: `/api`. All routes except `POST /auth/login` require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | public | Returns JWT + user |
| GET | `/auth/me` | any | Current session user |
| POST | `/auth/register` | Admin | Provision a new user |
| GET | `/auth/users` | Admin | List all users |

### Customers

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/customers` | any | Paginated. `?page&limit&search&status&customerType&sort&order` |
| GET | `/customers/:id` | any | Detail + follow-up history + recent challans |
| POST | `/customers` | Sales, Admin | Create |
| PUT | `/customers/:id` | Sales, Admin | Update |
| POST | `/customers/:id/follow-ups` | Sales, Admin | Append note, roll follow-up date, optionally change status |

Search matches name, mobile, business name, email and GST number, case-insensitively.

### Products & inventory

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/products` | any | Paginated. `?page&limit&search&category&lowStock&sort&order` |
| GET | `/products/categories` | any | Distinct categories for filter dropdowns |
| GET | `/products/:id` | any | Product + its last 50 ledger entries |
| POST | `/products` | Warehouse, Admin | Create (opening stock writes a ledger row) |
| PUT | `/products/:id` | Warehouse, Admin | Update — **cannot** change stock |
| POST | `/products/:id/stock` | Warehouse, Admin | Record an IN/OUT movement |
| GET | `/products/movements/all` | any | Global ledger. `?page&limit&type&productId` |

### Sales challans

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/challans` | any | Paginated. `?page&limit&search&status&customerId` |
| GET | `/challans/:id` | any | Full document with line items |
| POST | `/challans` | Sales, Admin | Create as `DRAFT` or `CONFIRMED` |
| PUT | `/challans/:id` | Sales, Admin | Edit — **drafts only**; confirmed documents are immutable |
| POST | `/challans/:id/confirm` | Sales, Warehouse, Admin | Confirm and reduce stock |
| POST | `/challans/:id/cancel` | Sales, Warehouse, Admin | Cancel; restores stock if it was confirmed |

### Dashboard

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/dashboard/summary` | any | Counters, low-stock list, recent challans and movements |

### Status codes used

| Code | When |
|---|---|
| 200 / 201 | Success |
| 400 | Validation failure (with `details[]`), duplicate product line |
| 401 | Missing, malformed or expired token; bad credentials |
| 403 | Authenticated but the role is not permitted |
| 404 | Record or route does not exist |
| 409 | Illegal state transition (confirm an already-confirmed challan), unique constraint |
| 422 | Business rule violation — insufficient stock |
| 500 | Unhandled; message is generic in production |

---

## Running locally

**Prerequisites:** Node 18+ and a PostgreSQL database. A free [Neon](https://neon.com)
project works and needs no local install.

```bash
git clone <repository-url>
cd erp-crm-portal
```

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```ini
# Runtime — POOLED endpoint (host contains "-pooler" on Neon)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=15"
# Migrations only — direct, unpooled endpoint (same host without "-pooler")
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

JWT_SECRET="a-long-random-string"
JWT_EXPIRES_IN="8h"
PORT=4001
NODE_ENV=development
CORS_ORIGINS="http://localhost:5173"
```

> **Why two URLs.** Neon's compute drops idle connections. A direct client hits that as
> `connection forcibly closed` — a 500 on the first request after a quiet spell. Routing
> runtime traffic through Neon's PgBouncer pooler fixes it, but PgBouncer's transaction mode
> can't run Prisma's migration DDL, so migrations use the direct endpoint via `directUrl`.
> With a plain local Postgres, set both to the same value.

> **Put the database in the same region as the API.** This was measured, not guessed. With
> the database in `us-east-2` and the client in India, every Prisma round trip cost ~250ms
> and the dashboard — which issues eleven queries — took **5.0s**. Moving the project to
> `ap-southeast-1` and raising `connection_limit` so those queries actually run in parallel
> brought the same endpoint to **0.85s**. Nothing about the code changed.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the schema and load demo data:

```bash
npx prisma migrate deploy
npm run seed
npm run dev
```

The API is on `http://localhost:4001`. Check `http://localhost:4001/health`.

### 2. Frontend

```bash
cd ../client
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:4001
npm run dev
```

Open `http://localhost:5173` and sign in with any account from the table above.

### Useful scripts

| Location | Command | Does |
|---|---|---|
| `server` | `npm run dev` | API with hot reload |
| `server` | `npm run build` | `prisma generate` + `tsc` |
| `server` | `npm run seed` | Load demo data (safe to re-run) |
| `server` | `npx prisma studio` | Browse the database in a GUI |
| `client` | `npm run dev` | Vite dev server |
| `client` | `npm run build` | Typecheck + production bundle |

---

## Environment variables

Nothing is hard-coded. `server/src/env.ts` reads and validates configuration once at boot
and **throws immediately if a required variable is missing** — the process refuses to start
half-configured rather than failing on the first request.

### Backend (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | **Pooled** Postgres connection string, used at runtime |
| `DIRECT_URL` | yes | **Unpooled** string, used only by `prisma migrate` |
| `JWT_SECRET` | yes | Token signing key |
| `JWT_EXPIRES_IN` | no (`8h`) | Token lifetime |
| `PORT` | no (`4000`) | Listen port; Render injects this |
| `NODE_ENV` | no | `production` suppresses debug detail in errors |
| `CORS_ORIGINS` | no | Comma-separated allowed origins, no trailing slash |

### Frontend (`client/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | yes | Backend base URL, no trailing slash |

Vite inlines `VITE_*` values at **build** time, so changing it on the host requires a
redeploy, not a restart.

`.env` is gitignored; `.env.example` is committed as the template. No secret is in the
repository or in any commit.

---

## Deployment

Three free services, no card required. Deploy in this order — each step needs a URL from
the previous one.

### 1. Database — Neon

1. Create a project at [neon.com](https://neon.com).
2. Copy **both** connection strings from the dashboard — the pooled one (host contains
   `-pooler`) for `DATABASE_URL`, and the direct one for `DIRECT_URL`.
3. Pick the region closest to your API region. Cross-region round trips are the reason
   Prisma's default 5-second transaction budget had to be raised.

### 2. API — Render

1. **New → Web Service**, connect the repo.
2. Settings:
   - **Root directory:** `server`
   - **Build command:** `npm install && npx prisma migrate deploy && npm run build`
   - **Start command:** `npm run start`
   - **Health check path:** `/health`
3. Environment variables:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string (with `&pgbouncer=true`) |
   | `DIRECT_URL` | Neon **direct** string — the build runs `prisma migrate deploy` |
   | `JWT_SECRET` | long random string |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGINS` | Vercel URL (add after step 3) |

4. Deploy. The build command runs `prisma migrate deploy`, so the schema is applied
   automatically.

   Demo data is seeded **once, from your machine**, against the same Neon database:

   ```bash
   cd server && npm run seed
   ```

   Render's free tier has no shell, and the seed is idempotent, so running it locally
   against the shared database is both simpler and safe to repeat.

`render.yaml` in the repo root declares the same setup as a Blueprint if you prefer
one-click provisioning.

### 3. Frontend — Vercel

1. **Add New → Project**, import the repo.
2. **Root directory:** `client` (framework auto-detects as Vite).
3. Environment variable `VITE_API_URL` = the Render URL, no trailing slash.
4. Deploy.

### 4. Close the CORS loop

Set `CORS_ORIGINS` on Render to the Vercel URL and redeploy. The API rejects any other
browser origin.

`client/vercel.json` rewrites all paths to `index.html` so deep links like
`/challans/<id>` resolve instead of 404ing.

> **Render free tier sleeps after 15 minutes of inactivity.** The first request afterwards
> takes 30–60 seconds. Open the API health URL a minute before a demo.

---

## Assumptions made

- **Roles are fixed at four.** They are a Postgres enum, not a permissions table. A real
  system would want per-permission grants; that is over-engineering for this scope.
- **Admin implicitly passes every role gate.** Simpler than enumerating admin on each route
  and matches how these teams actually work.
- **Prices are stored on the product, not in a customer-specific price list.** The customer
  type (Retail/Wholesale/Distributor) is recorded but does not yet drive slab pricing.
- **No tax computation.** GST numbers are captured, but challans are dispatch documents, not
  invoices, so no tax is calculated. Invoicing was outside the four required modules.
- **Cancelling a confirmed challan returns stock in full.** Partial returns are not modelled.
- **Login is email + password with an 8-hour JWT.** No refresh tokens, no password reset.
- **Address is split into line/city/state/pincode** rather than one free-text field, for
  usable filtering later.
- **Single currency (INR)** and a single warehouse identity; `location` is a free-text rack
  reference, not a modelled warehouse entity.

---

## Known limitations

- **Low-stock filtering happens in the application, not the database.** Prisma cannot compare
  two columns in a `where`, so `?lowStock=true` filters the fetched page. On a large
  catalogue this needs a raw SQL predicate or a generated column.
- **Pagination counts ignore the low-stock filter** for the same reason — the `total` reflects
  the unfiltered query.
- **JWTs are stored in `localStorage`.** Convenient and standard for an SPA, but readable by
  any XSS. `httpOnly` cookies plus CSRF protection would be the production choice.
- **No automated test suite.** Business rules were verified with a scripted smoke test against
  the running API (12 checks covering RBAC, validation, oversell rejection, transaction
  rollback, ledger writes, snapshot immutability, state guards and pagination). Converting
  those into Jest/Vitest with a test database is the obvious next step.
- **Stock validation is read-then-write inside a transaction.** Postgres' default
  `READ COMMITTED` isolation means two simultaneous confirmations of the *same* product could
  theoretically interleave. `SELECT … FOR UPDATE` or `Serializable` isolation would close
  this; at this scale it has not been necessary.
- **No refresh tokens** — an expired session requires signing in again.
- **Products are soft-flagged with `isActive` but there is no delete**, deliberately, since
  historical challans reference them.
- **Bonus items not attempted:** Docker, GitHub Actions, PDF export (the challan page uses
  the browser's own print-to-PDF instead), S3 image upload.

---

## Repository layout

```
erp-crm-portal/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma          # data model + design notes
│   │   ├── migrations/            # committed SQL migrations
│   │   └── seed.ts                # idempotent demo data
│   └── src/
│       ├── env.ts                 # validated configuration
│       ├── app.ts                 # middleware chain + route mounting
│       ├── index.ts               # bootstrap, graceful shutdown
│       ├── middleware/            # auth, validation, error translation
│       ├── modules/               # one router per domain
│       └── utils/                 # ApiError, pagination, response helpers
├── client/
│   └── src/
│       ├── lib/api.ts             # fetch wrapper, token handling, 401 redirect
│       ├── context/               # auth session, toasts
│       ├── components/            # layout, modal, pagination, badges
│       ├── pages/                 # one file per screen
│       └── styles.css             # design tokens + component styles
├── docs/
│   └── ERP-CRM.postman_collection.json
├── render.yaml
└── README.md
```

---

## Screen recording

A full walkthrough covering login as each role, the CRM flow, stock adjustment, challan
creation, the oversell rejection and the resulting ledger entries is included with the
submission.
