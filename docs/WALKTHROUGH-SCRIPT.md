# Screen recording walkthrough script

Target length: **8–10 minutes**. Everything below is something you can point at on screen.

The goal is not to list features — the reviewer can read the README for that. The goal is to
show that you understood the *business problem* and can defend your design choices. Three
ideas carry the whole recording:

1. Documents are immutable snapshots.
2. Stock is a ledger, not a number you edit.
3. Stock reduction is atomic — all lines or none.

If you only have five minutes, cut sections 2 and 7.

---

## Before you hit record

- [ ] Backend running, frontend running, both loaded once so nothing is cold.
- [ ] If deployed on Render free tier: **open the API health URL 60 seconds before** so the
      service is awake.
- [ ] Browser zoom at 100%, window maximised, bookmarks bar hidden.
- [ ] Close unrelated tabs. Have these open: the app, the GitHub repo, Postman, VS Code.
- [ ] Sign out so you start at the login screen.
- [ ] Have `Detergent Powder 2kg` in mind — it is the low-stock item (18 units) you will
      use for the oversell demo.

---

## 1 · Opening (30 seconds)

> "This is a mini ERP and CRM operations portal for a wholesale distribution business. The
> brief was four modules — authentication with roles, customer CRM, products and inventory,
> and sales challans.
>
> Stack is Node with TypeScript and Express on the backend, Prisma against PostgreSQL,
> React with TypeScript on the frontend. Database is on Neon, API on Render, frontend on
> Vercel.
>
> Rather than walk through every screen, I want to show you the three design decisions I
> think actually matter, because those are where the business logic lives."

---

## 2 · Login and roles (1 minute)

Show the login screen, point at the demo account list.

> "Four roles, seeded: Admin, Sales, Warehouse, Accounts. Simple JWT authentication."

Sign in as **Accounts**.

> "Accounts is the read-only role. Notice there's no 'Add Customer' button, no 'Adjust
> stock'. But hiding buttons isn't security — the UI only reflects the rule."

Open the browser devtools Network tab, or switch to Postman.

> "The actual enforcement is server-side. If I call the create-customer endpoint with the
> Accounts token directly, bypassing the UI entirely —"

Fire the Postman request **Auth → Login (Accounts)**, then **Customers → Create customer**.

> "— 403. The `requireRole` middleware rejects it before the handler ever runs. The frontend
> hiding the button is a convenience; this is the boundary."

Sign out, sign back in as **Admin**.

---

## 3 · The dashboard (45 seconds)

> "The dashboard is a single aggregated endpoint rather than the frontend making six calls.
> Customer counts split by lead and active, inventory totals, confirmed sales value, and the
> two things a manager actually acts on: low stock alerts and draft challans sitting unsent."

Point at the low-stock card.

> "Wheat Atta is at 45 against an alert level of 50. Detergent Powder is at 18 against 40.
> These aren't a status field somebody remembers to update — it's the live balance compared
> against each product's own threshold."

---

## 4 · CRM (1 minute)

Go to **Customers**. Type in the search box.

> "Search matches name, mobile, business name, email and GST number in one query, and it's
> debounced so it's one request when you stop typing, not one per keystroke. Filters for
> status and customer type, and it's paginated server-side — the API returns a meta block
> with page, total and total pages."

Open a customer detail page.

> "Detail page carries the follow-up timeline. This is the CRM part — every call or visit
> gets logged against the customer with who logged it and when."

Click **+ Follow-up**, add a note, set a next date, save.

> "One thing worth pointing out: adding the note and rolling the customer's next follow-up
> date forward happen in a single transaction. If they were separate writes and the second
> one failed, the timeline and the customer card would disagree about when to call them
> next. Small thing, but that's the class of bug that erodes trust in an internal tool."

---

## 5 · Inventory and the ledger (1.5 minutes)

Go to **Products**, open **Detergent Powder 2kg**.

> "Here's decision number two. There is no endpoint that sets stock to a number. You cannot
> edit this field."

Click **Edit** and show the form — no stock field.

> "The edit form deliberately has no stock input. The only way stock changes is through a
> movement."

Close, click **Adjust stock**. Record an **IN** of 50, reason "Purchase order received".

> "Every movement records quantity, direction, reason, who did it, and a reference back to
> whatever caused it."

Point at the ledger table that just updated.

> "So the balance you see at the top isn't a number somebody typed — it's reproducible by
> replaying this ledger. When the warehouse asks 'why does the system say 68?', the answer
> is right here."

Go to **Stock Movements** in the sidebar.

> "And this is the same ledger across every product. Opening stock, manual corrections,
> challan dispatches — all of it."

---

## 6 · Sales challan — the core flow (2.5 minutes)

This is the centrepiece. Do not rush it.

Go to **Sales Challans → + New Challan**.

Select a customer.

> "Pick the customer — the address and GST pull through."

Add two product lines with normal quantities.

> "Add lines. Running totals update live, and each line shows available stock."

Now change one line's quantity to something larger than available — e.g. Detergent Powder,
quantity 500.

> "Now watch. Detergent Powder only has 68 in stock. The moment I ask for 500, the line goes
> red, it tells me I'm short, and the Confirm button disables."

Point at the warning banner.

> "But — and this matters — I can still save it as a draft. That's deliberate. A salesperson
> taking an order in the field shouldn't be blocked because the warehouse hasn't received
> stock yet. Draft is a legitimate state."

Save as draft. Land on the challan detail page.

> "Challan number generated automatically. Draft status."

Now click **Confirm & reduce stock** so it fails.

> "And here's the real guard. The UI check I just showed you is a convenience — it's not
> what protects the data."

The 422 appears.

> "422, and it names the specific product and the exact shortfall. That error came from the
> server, inside a database transaction. Let me show you why that matters."

Switch to VS Code, open `server/src/modules/challans.routes.ts`, scroll to
`reduceStockForChallan`.

> "When a challan is confirmed, this loads every product on it in one query, then validates
> every line *before* writing anything. If line three of five is short, it throws — and
> because the whole thing is inside `prisma.$transaction`, the rollback means nothing was
> written at all. No partial dispatch, and stock can never go negative.
>
> That last part was the explicit requirement in the brief, and this is where it's enforced."

Go back, fix the quantity to something valid, confirm successfully.

> "Now it goes through."

Navigate to the product's ledger.

> "And the OUT movement is here, linked back to the challan, attributed to the user who
> confirmed it. The dispatch and the audit trail were written together, not by a separate
> job that might not run."

---

## 7 · Snapshots — the immutability decision (1.5 minutes)

Stay on the confirmed challan.

> "Third decision, and this is the one I'd most want to be asked about."

Point at a line item.

> "This line stores the product name, SKU and rate — copied at the moment the challan was
> created. Not looked up from the products table."

Open the product in another tab, rename it — e.g. "Detergent Powder 2kg — OLD PACK" — and
change the price.

> "So let me rename this product in the catalogue and change its price. That's a completely
> normal thing for a business to do — packaging changes, rates get revised."

Go back to the challan and refresh.

> "And the challan is unchanged. Old name, old rate."

> "If I'd only stored a product ID and joined at read time, renaming a product would have
> silently rewritten every historical dispatch note — including documents a customer already
> signed. For a system of record that's not acceptable. Same reasoning applies to the
> customer block at the top: name, GST number and address are frozen on the document.
>
> The foreign key is still there, so I can join for reporting. But the document itself is
> immutable."

Rename the product back.

Click **Print**.

> "And the challan prints as a clean document — the sidebar and buttons drop out via a print
> stylesheet. That covers PDF export through the browser without pulling in a PDF library."

---

## 8 · Code and repository (1 minute)

Switch to VS Code / GitHub.

> "Quick tour of how it's organised."

Show `server/src`:

> "One router per domain. Shared middleware for authentication, role checks, validation and
> error translation, so behaviour is consistent across modules rather than each route
> handling its own errors."

Open `middleware/errorHandler.ts`:

> "Single place that turns anything thrown into JSON. Prisma's unique-constraint error
> becomes a 409 with a readable message; unknown errors become a 500 that doesn't leak
> internals in production."

Open `env.ts`:

> "Configuration is read once at boot and throws immediately if something's missing — the
> process refuses to start half-configured rather than failing on the first request. Nothing
> is hard-coded; `.env` is gitignored and `.env.example` is the committed template."

Show the git log:

> "Commit history is incremental — schema, then middleware, then one commit per module."

---

## 9 · Honest close (45 seconds)

Do not skip this. Naming your own limitations is the strongest thing in the recording.

> "A few things I'd flag rather than have you find them.
>
> The low-stock filter runs in application code, not the database — Prisma can't compare two
> columns in a where clause, so that needs raw SQL to scale.
>
> The JWT is in localStorage, which is standard for an SPA but readable by any XSS. HttpOnly
> cookies with CSRF protection would be the production answer.
>
> There's no automated test suite. I verified the business rules with a scripted smoke test
> against the running API — twelve checks covering role denial, validation, the oversell
> rejection, transaction rollback, ledger writes and snapshot immutability. Converting those
> to Vitest against a test database is the first thing I'd do next.
>
> And stock validation is read-then-write inside a transaction. Under Postgres' default
> isolation, two simultaneous confirmations of the same product could theoretically
> interleave. `SELECT FOR UPDATE` would close that; at this scale it hasn't been necessary,
> but I know it's there.
>
> All of that's written up in the README along with the assumptions I made. Thank you."

---

## Questions you should be ready for

**"Why Prisma and not raw SQL / TypeORM?"**
Type safety across the boundary — the schema generates the types the handlers use, so a
column rename becomes a compile error. Migrations are versioned and committed. The tradeoff
is less control over the exact query, which is why the low-stock filter is a known
limitation.

**"Why store snapshots instead of joining?"**
A challan is a document, not a view. Joining means a catalogue edit rewrites history.
Covered in section 7.

**"What happens if two people confirm the same challan at once?"**
The status check and the stock write are in one transaction, so the second one sees
CONFIRMED and gets a 409. The narrower risk is two *different* challans for the same product
confirming simultaneously — `READ COMMITTED` could interleave the read-then-write. Fix is
`SELECT FOR UPDATE` or serializable isolation.

**"Why is challan numbering a counter table and not `COUNT(*) + 1`?"**
`COUNT(*) + 1` races — two concurrent creates both read the same count. The counter row is
incremented inside the transaction, so Postgres holds a row lock and the numbers can't
collide.

**"Why let a draft be saved with insufficient stock?"**
Because taking the order and fulfilling it are different events. Blocking the salesperson
because the warehouse hasn't received stock yet would push them to record orders outside the
system, which is worse. Confirmation is the gate, and it's enforced server-side.

**"Why no invoice module?"**
The brief named four required modules; invoices appear only in the business context
paragraph. I chose to finish the four properly rather than half-build a fifth. It's listed
under limitations.

**"How long did this take?"**
Answer honestly.

**"Did you use AI tooling?"**
Answer honestly. Most teams assume you did and don't mind — what they're testing is whether
you understand and can defend the system. Sections 5, 6 and 7 above are that proof, which is
why they're the bulk of the recording. If you can explain the transaction boundary and the
snapshot decision without notes, the tooling question stops mattering.
