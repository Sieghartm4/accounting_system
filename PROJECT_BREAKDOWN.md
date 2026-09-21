# Accounting System — Complete Project Breakdown

A full MERN multi-tenant accounting suite. This document describes the whole system so you can paste it into any AI and ask questions about the project without uploading code. Sections are independent — use the Table of Contents to jump to a topic.

---

## TABLE OF CONTENTS
1. High-Level Summary
2. Repository Layout & Tech Stack
3. Architecture & Multi-Tenancy
4. Authentication, Sessions & Security
5. Permissions / Access Control
6. Data Model (Database Schema)
7. Core Accounting Model (Journal Entries)
8. Modules & Features (page by page)
9. Key Business Workflows
10. Reports
11. Tax Compliance (BIR Forms)
12. Dashboard
13. Real-Time (WebSocket)
14. PDF / Excel / Import-Export
15. Subscription Service & Billing
16. Migration & Seeding Workflow
17. Known Quirks & Gotchas
18. Commands (run / dev / db)
19. Environment Variables

---

## 1. HIGH-LEVEL SUMMARY

- **What it is:** A web-based (browser) accounting system for small-to-mid businesses, with a **SaaS / multi-tenant** model. Every company (tenant) gets **its own MySQL database**; a separate "subscription / platform" service provisions databases, sells plans (PayMongo), and enforces subscription expiry.
- **UI:** React 19 SPA (Vite + Tailwind). Dark sidebar navigation, reusable data table (`DynamicTable`) used by nearly every page, right-side slide-over forms, toasts, confirm modals, PDF printing from the browser.
- **API:** Express REST API. Business logic lives in `server/src/controller/*.controller.js`. All financial data funnels into a single `journal_entries` table — **every report reads from there**.
- **Accounting flow:** Users create documents (sales, purchases, receipts, etc.) in `PREPARED → CHECKED → APPROVED` states. Only **APPROVED** documents generate/post journal entries and appear in financial reports. Cancelled/rejected documents are excluded from reports without deleting their data.
- **Two servers + one client:**
  - `client/` — React SPA (login, dashboards, modules).
  - `server/` — accounting API (all business/accounting features).
  - `subscription/` — platform/tenant server (registration, plans, billing, tenant-DB provisioning, admin panel).

---

## 2. REPOSITORY LAYOUT & TECH STACK

```
D:\5L_SYSTEMS\accounting_system\
├─ package.json              (npm workspaces: client + server; db scripts at root)
├─ .env                      (shared secrets/config — NEVER commit)
├─ .sample.env               (template of all needed env vars)
├─ DEVELOPER_GUIDE.txt       (full API guide, endpoints, data flows)
├─ USER_DOCUMENTATION.txt    (non-technical user guide)
├─ client/                   (React SPA)
│  └─ src/
│     ├─ App.jsx             (all routes, each wrapped in ProtectedRoute)
│     ├─ pages/<module>/     (per-module: <Name>.jsx + form + use<Name>.js hook)
│     ├─ components/         (DynamicTable, RightSideModal, ProtectedRoute,
│     │                       ProtectedAction, DynamicToast, ConfirmModal, LoadingScreen, layout/)
│     ├─ contexts/SecureAuthContext.jsx
│     └─ utils/              (api.js wrapper, generate*PDF.js, routeProtection.js)
├─ server/                   (accounting Express API + MySQL + MongoDB)
│  └─ src/
│     ├─ controller/         (business logic, one file per module)
│     ├─ routes/             (URL mapping)
│     ├─ middlewares/        (auth, cors, csrf, logger, rate-limit, report query validation)
│     ├─ database/
│     │  ├─ migrations/create|alter/   (Sequelize migrations)
│     │  ├─ seeders/                   (seed data)
│     │  ├─ model/           (Master.js, Accounting.js — auto-generated table metadata)
│     │  └─ util/            (query wrapper, tenant pool, migrate/seed utilities)
│     ├─ schemas/            (joi/zod validation per table)
│     ├─ startup/            (session, docs/swagger, routes, socket, static files)
│     ├─ util/               (cryptography, helper/SQL builder, logger, email)
│     └─ docs/swagger.docs.yaml
└─ subscription/             (platform/tenant service — signup, plans, billing, admin)
```

**Client stack:** React 19, Vite 7, Tailwind CSS 4, React Router 7, TanStack Query, chart.js/react-chartjs-2 + ECharts, lucide-react, framer-motion, jspdf + jspdf-autotable (PDF), xlsx (Excel), react-hot-toast, react-to-print.

**Server (accounting) stack:** Node/Express 4, MySQL via sequelize + mysql2 (raw SQL via custom query builder), express-session + connect-mongo (sessions in MongoDB), JWT (jsonwebtoken), helmet, express-rate-limit, winston + morgan (logging), swagger-ui-express, pdfkit (server PDFs only for BIR forms), nodemailer, socket.io is NOT used — real-time is raw `ws`, `mongoose` for MongoDB access.

**Subscription stack:** Node/Express, MySQL (sequelize + mysql2), MongoDB (session store + tenant→db mapping collection), PayMongo (GCash/card/PayMaya payments), node-cron (daily subscription expiry), `ws`.

---

## 3. ARCHITECTURE & MULTI-TENANCY

### Tier 1 — Client (React SPA)
- Connects to **two** backends:
  - `VITE_SUBSCRIPTION_LINK` → subscription service (login, register, plans, payment, admin).
  - `VITE_SERVER_LINK` → accounting server (everything business-related).
- The fetch wrapper (`client/src/utils/api.js`) injects `credentials: 'include'` (cookie-based session) and auto-logout on `TOKEN_EXPIRED` (401).

### Tier 2 — Subscription / platform service (`subscription/`)
- Holds the **admin** MySQL database with a `master_user` table containing username → **tenant database name** (`db_name`) → `subscription_id` → `mu_role` (ADMIN/USER).
- On login it writes/updates a mapping record in MongoDB (collection `ACCOUNTINGSubscription`): `{ userId, username, db_name }`.
- It also proxies the login to the accounting server to obtain the tenant-user id and route access.

### Tier 3 — Accounting server (`server/`)
- Multi-tenant: on every request, the **auth middleware** reads the JWT (from session cookie or `Authorization` header), finds `dbName`, and calls `CONFIG.setTenantDb(dbName)`.
- `server/src/database/util/tenantConnection.util.js` creates and caches a MySQL connection pool **per tenant (`db:userId`)**.
- `server/src/database/config/config.js` uses a Proxy so "the default database" resolves to the current request's tenant DB.
- The `Query()` helper (`server/src/database/util/queries.util.js`) runs all controllers' SQL against the right pool and strips table prefixes from result columns.

### Tenant provisioning
- Signup (`POST /credentials/register`): inserts the user into the admin `master_user`, then `createTenantDatabase` does: create MySQL DB `{company}_accounting` → run the tenant migrations snapshot (`subscription/src/database/migrations/subscription`) → run tenant seeders → inject the owner user + company row → return progress (SSE variant `register-progress` streams 5% → 100%).

---

## 4. AUTHENTICATION, SESSIONS & SECURITY

### Login flow
1. User submits username/password on the client.
2. Client calls `POST {subscription}/credentials/login` (rate-limited: 10 tries / 15 min per IP+username).
3. Subscription service: finds user in admin `master_user` (must be `status='active'`). **Non-ADMIN users without a `subscription_id` get 403 `requiresSubscription`** (must pick a plan / free trial first).
4. It proxies to the accounting server's `/credentials/login`, gets the tenant user id + route permissions, then signs a JWT `{ userId, username, dbName }` (24 h expiry, `_SECRET_KEY`), stores it in the express session cookie (`accounting.sid`, MongoDB-backed) and the client also caches user info in `sessionStorage`.
5. `role === 'ADMIN'` users are redirected to the **subscription admin panel** (`/admin`).
6. Client refreshes the session every 19 minutes (`POST /api/auth/refresh`); token cans expire at 24 h.

### Session & JWT
- **Session:** `express-session` + `connect-mongo` (MongoStore). Cookie: `accounting.sid`, `secure: 'auto'`, sameSite lax, shared domain across both services.
- **JWT:** signed with a shared `_SECRET_KEY` so both services can verify. Payload = `{ userId, username, dbName }`.
- Accounting API accepts the token from `req.session.jwt` first, then the `Authorization: Bearer` header.

### Security measures
- `helmet`, CORS whitelist (`_CORS_ORIGINS` + derived local URLs, `credentials: true`).
- **CSRF middleware** on every non-GET request (except health/login): client must send `x-csrf-token` (from session), else `403 CSRF_INVALID`.
- **Login rate limiter** (429 after 10 attempts).
- **Encrypted config:** DB password in `.env` is AES-encrypted and decoded at runtime via `DecryptString` (crypto util). Subscription user passwords are AES-encrypted too (not bcrypt).
- **Dev-only bypass:** `_DEFAULT_API_TOKEN` + `_ALLOW_DEFAULT_TOKEN=true` (or non-production) lets a fixed token bypass JWT verification, with tenant override via `x-tenant-db` / `x-tenant` headers.
- `trust proxy = 1` so `secure: 'auto'` works behind TLS-terminating proxies.
- `reportQueryValidation` middleware validates report `start_date/end_date`, `type`, `account_code` formats.

---

## 5. PERMISSIONS / ACCESS CONTROL

- **Roles** come from `master_access` (`access_id`, `access_name`).
- **Route-level permissions** live in `master_route_access`: rows of `(access_id, name=route_name, status)`.
- Route names correspond to pages: `sales`, `purchase`, `payments`, `collections`, `receipts`, `disbursement`, `adjustments`, `customers`, `vendors`, `vat`, `witholding_tax`, `responsibility_center`, `charts`, `users`, `access`, `company`, `trial_balance`, `income_statement`, `general_ledger`, `balance_sheet`, `journal_entries`, `bank_reconciliation`, `audit_trail`, `proforma_entries`, `product_service`, `purchase_order`, `aging_receivables`, `aging_payables`, `tax_compliance`, `advances` / `dashboard`.
- **Access levels (client):** `full access`, `edit access`, `view access`, `check access`, `approve access`, `add access` — the client (`client/src/utils/routeProtection.js`) uses these to hide pages/buttons:
  - `ProtectedRoute` — blocks a whole page; no access → redirect.
  - `ProtectedAction` — wraps individual buttons (create/edit), hidden if the user lacks the right level.
  - Some routes allow multiple route names (e.g. `tax_compliance` requires access to `tax_compliance` OR `vat` OR `witholding_tax`).
- **Server-side:** role/access checks are enforced in controllers (`access.controller.js`, e.g. `checkAccess` for approve actions).
- Sidebar menus are generated from the permissions (`getSidebarItems`).

---

## 6. DATA MODEL (DATABASE SCHEMA)

Each tenant has its own MySQL database with the same schema. Column names are **prefixed** by table in the generated model files (`Master.js`, `Accounting.js`) — e.g. `sales` → `s_id`, `s_customer_id`; `collections` → `c_id`; `journal_entries` → `je_id`. The query helper strips these prefixes so the API returns clean column names (`id`, `customer_id`).

### Master / reference tables (per tenant)
| Table | Purpose |
|---|---|
| `master_access` | Roles (e.g. ADMIN, user levels) |
| `master_user` | Users: `fullname, username, password, access_id, email, status, role, subscription_id` |
| `master_company` | Company profile shown on PDFs: name, owner, logo, address, TIN, website, email, phone |
| `master_route_access` | Route permission matrix (access_id × route name × status) |
| `charts_of_accounts` | GL accounts: `code, name, type (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), description, status` |
| `customers` + `customers_information` | Customer master + extended info (`address, tin, contact`, details JSON) |
| `vendors` + `vendors_information` | Vendor master + extended info |
| `products_service` | Product/service catalog: code, name, type (SERVICE/PRODUCT), category, sales/purchase price, unit |
| `vat` | VAT configs: `code, name, rate, type (Zero-rated/Vatable/Exempt), sub_type (Services/Goods/Capital Goods), description, status` |
| `withholding_tax` | WHT configs: `code, name, rate, tax_account, description, status` — the `tax_account` is used for BIR ATC codes |
| `responsibility_center` | Cost centers: `code, name, department, status` (departments e.g. IT, CABLING, SHELL, FINANCE, R&D, ADMIN, PERSONAL, SALES) |
| `proforma_entries` | Draft/template entries: module, name, coa_id, t_account |
| `purchase_order` | Purchase orders: vendor, product, quantity, price, responsibility_center, status |
| `audit_trail` | App-level audit log: transaction_id, module, performed_by, created_date/time, action |

### Transaction tables (per tenant)
All transaction types follow a pattern: a **header** table + an **_items** table (line items) + optional **_attachments** table (file uploads). Headers carry: `document_reference` (unique), amounts, `created_by / checked_by / approved_by`, `created_date`, and a **state/status** enum.

| Module | Header table | Items table | Notes |
|---|---|---|---|
| Sales invoices | `sales` | `sales_items` | terms (NET_30 etc.), `date_delivered`, `date_due`, `total_amount_due`, `status` (UNPAID / PARTIALLY PAID / PAID / OVERPAID / REJECTED), `state` (PREPARED/CHECKED/APPROVED/CANCELLED) |
| Receipts (cash-in, no invoice) | `receipts` | `receipt_items` | `collection_date`, mode_of_payment, bank/check info, `total_amount_due` |
| Cash disbursements (cash-out) | `cash_disbursements` | `cash_disbursement_items` | vendor_id, payment_date, mode_of_payment, category/expense account |
| Collections (AR settlement) | `collections` | `collection_items` | **Applies a payment to a `sales` invoice** (`sales_id`, `amount_applied`), `collected_amount` |
| Purchases | `purchase` | `purchase_items` | vendor_id, `date_delivered`, `date_due`, `paid_amount`, status, state |
| Payments (AP settlement) | `payments` | `payment_items` | **Applies a payment to a `purchase` invoice** (`purchase_id`, `amount_applied`), `paid_amount` |
| Adjustments (manual GL entries) | `adjustments` | `adj. lines stored with debit/credit per COA` | `posting_date`, balanced debits = credits |
| Purchase orders | `purchase_order` | — (single-line, product + qty + price) | convert to purchase/disbursement |

### Line-item calculation columns (sales_items / purchase_items / receipt_items / cash_disbursement_items)
`quantity`, unit price, `discount` + `discount_type` (PERCENT/FIXED), `vat`, `witholding_tax`, `responsibility_center`, `charts_of_accounts` (revenue/expense mapping), plus derived `gross → discount_amount → taxable → vat → wht → net`.

### Journal entries (the core)
| Column | Meaning |
|---|---|
| `db_name` | Source module: SALES, RECEIPT, COLLECTION, PURCHASE, PAYMENT, DISBURSEMENT, ADJUSTMENT |
| `db_id` | ID of the source document (no FK — tracked by db_name + db_id) |
| `coa_id` | Chart-of-accounts account |
| `type` | DEBIT / CREDIT |
| `amount` | Amount |
| `date` | Posting date |
| `responsibility_center` | Cost-center tag |

**This table is the single source of truth for all reports.** Trial Balance, Income Statement, Balance Sheet, GL, bank reconciliation, dashboard, and tax compliance all query `journal_entries` (joined to `charts_of_accounts`), filtered to source documents whose state = APPROVED.

### Subscription platform tables (admin DB, in `subscription/`)
| Table | Columns of note |
|---|---|
| `master_user` (admin) | adds `db_name` (tenant DB), `mu_role` (ADMIN/USER), `subscription_id` |
| `subscription_plans` | `sp_code, sp_name, sp_description, sp_status (PUBLIC/PRIVATE)` |
| `subscription_plan_items` | `spi_type` = `BILLING_CYCLE` / `PRICE` / `MODULES` / `FEATURES` / `USERS`, `spi_details` (value), `spi_display_order` |
| `subscription_history` | `sh_mu_id, sh_subscription_id, sh_price, sh_billing_cycle, sh_start_date, sh_end_date, sh_status (active/expired/cancelled), sh_payment_method, sh_payment_reference` |
| `tax_forms` (newer, in tenant DB) | `tf_form_type, tf_user_id, tf_company_id, tf_start_date, tf_end_date, tf_form_data (JSON), tf_status (draft/filed/filed_with_bir/rejected)` |

### Table relationships
- customers → 1..N sales, receipts, collections
- vendors → 1..N purchase, payments, cash_disbursements
- sales → N sales_items; purchase → N purchase_items
- sales ← N collection_items (a collection applies to a sales invoice); purchase ← N payment_items
- charts_of_accounts ← many sales_items / purchase_items / journal_entries / bank_reconciliation
- journal_entries references every document via `db_name + db_id` (no FK)

---

## 7. CORE ACCOUNTING MODEL (HOW EVERYTHING POSTS)

**Golden rules:**
1. Creating a document stores it in PENDING/PREPARED state and inserts its **journal entry rows immediately** (linked via `db_name`/`db_id`).
2. Appointing **APPROVED** state is what "posts" the transaction. Reports/ledgers/dashboard/tax only count rows whose **source document is APPROVED** (approved-document filter / `approvalFilter` in controllers).
3. Editing a pending document **deletes and re-inserts** its journal rows (and downstream collection/payment entries when amounts/dates change).
4. **CANCELLED/REJECTED** documents keep their rows in the DB but are excluded from all reports automatically.
5. Manual adjustments must be balanced (total debits = total credits) or they are rejected.

### Standard journal postings
| Transaction (on APPROVE) | Debit | Credit |
|---|---|---|
| Sales invoice | AR (Accounts Receivable) | Revenue account (+ VAT payable if any) |
| Collection (AR payment) | Cash/Bank | AR |
| Receipt (cash-in) | Cash/Bank | Income/AR |
| Purchase | Expense/Inventory | AP (Accounts Payable) |
| Payment (AP) | AP | Cash/Bank |
| Cash disbursement | Expense (category) | Cash/Bank |
| Adjustment | per user (must balance) | per user |

### Approval state machines
- Standard: `PREPARED → CHECKED → APPROVED` (sets `checked_by`, then `approved_by`, audit entries per step).
- `REJECTED` and `CANCELLED` are terminal states. Cancellation allowed unless already CANCELLED/REJECTED.
- On approving a Collection/Payment, the controller recomputes every linked invoice's `collected_amount`/`paid_amount` (sum of approved applications) and derives status `PAID`, `PARTIALLY PAID`, `UNPAID`, or `OVERPAID`.

### Document ID generation
e.g. sales `SO-MMDDYY-####` pattern; collections/payments keep `document_reference` unique per module.

---

## 8. MODULES & FEATURES (PAGE BY PAGE)

### Dashboard
`GET /dashboard?start_date&end_date&responsibility_center`. Card "fh" (financial health: net income, gross revenue, margin %, cash position, receivables, payables, working capital, net cash movement, change-vs-prior-period %), "cf" (cash-flow activity: receipts + collections − disbursements − payments), tax summary, AR aging buckets, top vendors, bank account reconciliation status, recent transactions, alerts (trial-balance balanced?, balance-sheet balanced?, overdue AR/AP), monthly revenue-vs-expense trends, transaction volumes, an **EWT deadline countdown** (10th of next month).

### Masters (setting pages)
- **Company** — manage company profile used on all printed documents (logo upload).
- **Access Control** — assign route permissions per role.
- **Users** — create/edit users and their roles; only active users can log in.
- **Charts of Accounts** — manage GL accounts (code, name, type, status). New accounts instantly usable in transactions.
- **Products & Services** — item catalog for line items.
- **Proforma Entries** — draft template entries (no GL effect until converted).
- **Customers / Customer Transactions** — master data + per-customer document history with balances.
- **Vendors / Vendor Transactions** — master data + per-vendor history.
- **VAT** — CRUD + CSV import/export of VAT rate configs.
- **Withholding Tax** — CRUD + CSV import/export of WHT configs (with `tax_account` used for ATC in BIR forms).
- **Responsibility Center** — cost-center master (code auto-generated like `RC-1234`, department field, CSV import).

### Transactions
- **Receipts** — cash-in without an invoice (Debit Cash, Credit Income/AR). Editable until approved; attachments; PDF.
- **Disbursements** — cash-out without an invoice (Credit Cash, Debit Expense). Same lifecycle; PDF.
- **Sales** — credit-sales invoices; multi-line items with auto VAT/WHT/discount math; approve → AR postings; print internal/customer copy.
- **Collections** — customer payments applied to one or more sales invoice(s); approve → Cash↑ AR↓; runs the "to be collected" list of open invoices; partial payments tracked per invoice.
- **Purchase** — vendor invoices; approve → Expense/Inventory & AP; convert from Purchase Order; print.
- **Purchase Orders** — requisitions; approve; convert to Purchase or Disbursement.
- **Payments** — vendor payments applied to purchase invoice(s); approve → AP↓ Cash↓; "to be paid" open-invoice list.
- **Adjustments** — manual GL entries (accruals, corrections, reclassifications, depreciation); must balance; approve posts directly; supports Excel upload of line rows.
- **Advances** — view **unlinked/stand-alone journal entries** (`db_name` empty) on the GL; batch-select them and hand them off to the Adjustments page to convert into balanced adjustment vouchers.

### Aging (client-computed over the sales/purchase lists)
- **Aging Receivables** — all non-paid, non-cancelled sales grouped by days overdue from `date_due`, live "days overdue" flip-clock per row; buckets current / 1–30 / 31–60 / 61–90 / 90+.
- **Aging Payables** — mirror for open purchases against vendors.
- (Server also computes AR aging buckets `current, overdue_1_30, overdue_31_60, overdue_61_plus` in the dashboard.)

---

## 9. KEY BUSINESS WORKFLOWS

**Credit sale → collection (AR lifecycle):**
1. Create Sales (PREPARED). Edit allowed until APPROVED.
2. Check → Approve: posts DR AR, CR Revenue (+ VAT). Adds to AR balance.
3. Customer pays → create Collection, choose the open invoice(s), amount applied.
4. Approve collection: posts DR Cash, CR AR; recomputes the sale's `collected_amount` & status (PAID/PARTIALLY PAID/OVERPAID).

**Purchase → payment (AP lifecycle):** mirror — approve purchase posts DR Expense, CR AP; approve payment posts DR AP, CR Cash and updates the purchase's `paid_amount`/status.

**Cash-only flows:** Receipts (DR Cash, CR Income) and Disbursements (CR Cash, DR Expense) — no invoice needed.

**Adjustment flow:** create balanced debit/credit voucher → approve → direct GL posting (appears in Trial Balance/GL/Balance Sheet immediately).

---

## 10. REPORTS

All under `GET /reports/…`, all date-validated (`start_date`/`end_date` = `YYYY-MM-DD`), all restricted to **approved** source documents:

| Report | What it returns |
|---|---|
| `/trial-balance` | Per-COA SUM(DEBIT)/SUM(CREDIT) and balance; check total debits = credits |
| `/income-statement` | REVENUE (credits−debits) vs EXPENSES (debits−credits) → net income |
| `/general-ledger` | Per-account detail with running entries; filter by `account_code`, amount, type; defaults to current month |
| `/balance-sheet` | ASSETS / LIABILITIES / EQUITY by account-type sign; synthetic row `300999 Current Period Net Income`; must balance |
| `/statement-of-comprehensive-income` | Income statement + OCI (EQUITY accounts whose code/name contain OCI/Revaluation/Unrealized) |
| `/journal-entries` | All posted lines enriched with source doc reference, payee name + TIN, voucher id (`db_name:db_id`), check number |
| `/journal-entries/coa/:coa_id` | Drill-down per account with totals |
| `/advances` | Stand-alone (unlinked) journal entries |
| `/bank-reconciliation` | Cash GL balance vs bank statement balance; outstanding items, deposits in transit, difference, `is_reconciled` |

**Bank reconciliation module** (`bank_reconciliation.controller.js`) is richer: create a recon header (bank account + COA + `bank_statement_balance`), add items (`debit/credit/balance`), match/unmatch to GL ledger entries (`ledger_id`), add reconciling adjustments (`adjustment_balance` table), and generate a summary (`bank_reconciliation_summary`). The client `BankReconciliation.jsx` + `BankReconciliationDetail.jsx` classify items into bank/book sections (deposits_in_transit, outstanding_checks, interest_income, bank_charges, NSF, credit/debit memos, error bank/book).

**Global header search:** `GET /reports/search?search&searchFields&startDate&endDate&allowedRoutes`. Searches across sales, collections, receipts, purchase, disbursement, payments, adjustments (`LIKE %term%`); results unify as `document_type, document_id, document_reference, customer_name, document_date, amount, remarks, state, created_by`, with module extras (mode of payment, bank/check). Restricted to routes the current user can access.

---

## 11. TAX COMPLIANCE (BIR FORMS)

`GET/POST /tax-compliance/*`, new module:
- **`GET /calculate-tax?start_date&end_date`** — derives from `journal_entries` by COA names: `outputVAT` (Output VAT credit−debit), `inputVAT` (Input VAT debit), `netVATPayable`; `wtExpanded` (Withholding Tax - Expanded), `wtCreditable` (Creditable Withholding Tax). Returns a full journal list with per-voucher `referenceNo`, `payeeName`, `payeeTin`, `atc` (from the `withholding_tax.tax_account`/`wt_code` linked on line items), and `withholdingRate`.
- **`POST /save-draft`** — upserts a `tax_forms` draft row per (form type + company + date range).
- **`POST /mark-filed`** — status → `filed_with_bir`.
- **`POST /export-pdf`** — server-side PDFKit **BIR form templates**: **2550M** (Monthly VAT Declaration), **0619E** (Monthly Remittance Return of Creditable Income Taxes Withheld), **2307** (Certificate of Creditable Tax Withheld at Source), **1601EQ** (Quarterly Return).
- **`POST /export-dat`** — SAWT-format pipe-delimited `.dat` file (records `001|…002|…003|…` trailer with total tax).
- **`POST /export-xml`** — `<BIRTaxReturn>` XML export.
- **`GET /draft/:id`** — load a saved draft.
- Client: `TaxCompliance.jsx` composes the BIR form rows from journal data and offers draft save + these exports.

Related master pages: `VAT` (rate configs), `Withholding Tax` (rates + tax accounts/ATC), and the tax compliance page groups both.

---

## 12. DASHBOARD (details)

- Fields: `start_date`, `end_date`, `responsibility_center` (filters KPIs by cost center, sanitized).
- Date filters are applied per module using each module's own date column (`sales → s_date_delivered`, etc.).
- `financialHealth`: net income, gross revenue, margin %, change vs prior period, cash position (Cash on Hand / Petty Cash / Cash in Bank / check accounts by COA code/name patterns), total receivables (approved sales − approved collections), total payables, working capital, net cash movement.
- `cashFlowActivity`: receipts + collections − disbursements − payments.
- `tax`: output VAT, input VAT, net VAT payable, expanded WHT, creditable WHT (same COA logic as tax compliance).
- `arAging`: 5 buckets from open sales (`due_date` parsed with `STR_TO_DATE` supporting `yyyy-mm-dd`, `mm/dd/yyyy`, `mm-dd-yyyy`).
- `bankAccounts`: per bank-account reconciliation row → GL balance vs computed bank balance, variance, `reconciled` flag, unreconciled count.
- `alerts`: trial balance balanced?, balance sheet balanced?, overdue counts/amounts.
- `trends`: monthly revenue-vs-expense and cash flow UNION queries.
- Client renders ECharts performance/aging charts, KPI cards, recent transactions.

---

## 13. REAL-TIME (WEBSOCKET)

- Accounting server starts a raw `ws` WebSocket on the same HTTP port (`server/src/startup/socket.startup.js`); `broadcastUpdates(data, type)` sends JSON to all open sockets with `readyState === 1`. No rooms/auth.
- Controller broadcasts (after create):
  - `sales_created`, `collection_created`, `receipt_created`, `purchase_created`, `payment_created`, `adjustment_created`, `disbursement_created`, `journal_entries_created`.
- Client pages open `new WebSocket(window.WS_SERVER_LINK)` and, on matching event, refresh/prepend the table (sales, collections, receipts, purchase, disbursements, payments, adjustments, advances). Socket closed on unmount. Pattern repeated per page (not centralized).
- The notification bell in the header is currently a static UI element (no live feed wired).

---

## 14. PDF / EXCEL / IMPORT-EXPORT

- **PDF (documents):** generated **client-side** with jspdf + jspdf-autotable. Each module has `client/src/utils/generate{Module}PDF.js` taking `(data, copyType)` = `'internal'` | `'customer'`. Shared `pdfCompanyHeader.js` renders the letterhead (logo, company info, TIN formatted like 3-3-3-5 or 3-3-3-5-3). The client first fetches print JSON from server endpoints (`GET /sales/print/:id`, `/collection/print/:id`, `/receipt/print/:id`, `/purchase/print/:id`, `/cash_disbursement/print/:id`, `/payments/print/:id`), then builds the PDF in the browser. Also `generateBankReconciliationPDF.js`.
- **PDF (tax/BIR):** server-side via **PDFKit** only in the tax-compliance controller (see §11).
- **Excel:** `xlsx` in the client. Reports pages (Balance Sheet, Income Statement, General Ledger, etc.) export `.xlsx` workbooks. Adjustments form accepts Excel upload → parsed to adjustment line rows.
- **CSV import/export:** VAT, Withholding Tax, Responsibility Center pages (bulk create/import endpoints like `POST /vat/import` with `{created, updated, errors}`).

---

## 15. SUBSCRIPTION SERVICE & BILLING

The `subscription/` Express app is the **platform layer**:

- **Login/Register:** `POST /credentials/login`, `/register` (tenant signup + automatic tenant DB creation), `/register-progress` (SSE progress version).
- **Plans:** `GET /subscription-plans` (all), `GET /subscription-plans/public` (PUBLIC, sorted by price asc; derives `sp_price` from the `PRICE` plan item), `GET /subscription-plans/:id`, `POST/PUT/DELETE /subscription-plans[/:id]` (admin CRUD; plan items replace wholesale on update).
- **Payments (PayMongo):** `POST /subscription-plans/checkout` (creates a PayMongo checkout session; methods gcash/card/paymaya; currency PHP; success → `/register?payment=success&session_id=…`), `GET /subscription-plans/payment-details/:session_id`, `POST /subscription-plans/verify-payment` (fails unless status `paid`; then inserts an active `subscription_history` row).
- **Subscription assignment:** `PUT /credentials/subscription`, `POST /credentials/subscription-history`, admin `PUT /users/:id/subscription` (expires the previous active plan first).
- **Free-trial controls:** `GET /credentials/check-free-trial`, `GET /credentials/used-free-trials` (prevents multiple $0 trials).
- **Expiry:** daily cron (`node-cron`, midnight) calls the SQL stored procedure `expire_subscriptions()` → strips `subscription_id` from expired users and flips history rows to `expired`. Manual run: `POST /credentials/expire-subscriptions`.
- **Session user:** `GET /credentials/me`.
- **Admin UI:** `GET /admin` serves `subscription-admin.html` — plan CRUD (price/cycle/visibility, plan-item rows) and Master Users management (view users/plans/DBs, change subscription). Login via JWT from `/login` redirect. (The separate `public/js/subscription-admin.js` + `.css` are an older stale variant; the served HTML uses its own inline JS/CSS.)
- **Auth note:** `auth` middleware exists but is currently **not mounted** in the subscription service — endpoints rely on the express session / MongoDB mapping. Login still enforces `subscription_id` for non-ADMINs.
- **Seeded plans:** BASIC = 7-day free trial (FREE, 1 user, PUBLIC), PRO = 30 days / ₱4,999 / 2 users / all modules, PREMIUM = 30 days / ₱9,999 / 5 users / all modules + extras, `5L` = annual internal (365 days, free, 1000 users, PRIVATE).

---

## 16. MIGRATION & SEEDING WORKFLOW

- Migrations live in `server/src/database/migrations/{create,alter}/`; seeders in `server/src/database/seeders/`.
- **Model regeneration:** after every migrate, `generateModels.util.js` scans the migrations and regenerates `model/Master.js`, `Accounting.js`, etc. — controllers always see up-to-date column metadata.
- **Per-tenant migrations:** `migrateAllTenants.util.js` reads all `db_name`s from the admin `master_user`, then runs `migrateTenantDb.util.js --db=<tenant>` which temporarily points `_DATABASE_ADMIN` at that tenant and runs `sequelize-cli db:migrate`. `seedAllTenants.util.js` / `seedTenantDb.util.js` do the same for seeds.
- **Self-provisioning snapshot:** `subscription/src/database/migrations/subscription` + `seeders/subscription` are a frozen copy of the accounting schema so the platform service can create a full tenant DB at signup without depending on the server repo. Because it’s a snapshot, newer server migrations (e.g. `tax_forms`, partial-payment alterations) are **not** applied to freshly provisioned tenants — the util compensates for missing `mu_role`/`subscription_id` columns with runtime ALTER checks.
- **DB setup script:** `dbSetup.util.js` creates the DB if missing, runs migrations + seeds, regenerates models + schema.
- **Triggers/procedures:** folders `server/src/database/sql/triggers/*` and `store_procedure` are **empty scaffolding** — no DB triggers are used; audit trails are application-level. The one real stored procedure, `expire_subscriptions()`, is created by the subscription migration `20260825130000-create-subscription-expiry-trigger.js`.

---

## 17. KNOWN QUIRKS & GOTCHAS (useful when answering "why/where" questions)

1. **Status enum value is `'PARTIALLY PAID'` (with a space)**, but **dashboard queries for payables/overdue/top-vendors still filter `status IN ('UNPAID','PARTIAL')`** — `'PARTIAL'` never matches the new value (potential reporting gap for partially paid purchases).
2. **`payments` and `collections` both use the `c_` prefix** in the generated `Accounting.js` model (legacy design). They are queried separately so it works, but table aliases must be distinguished in custom SQL.
3. **Two login paths:** the client logs in through the **subscription** server (which proxies to the accounting server). Both services sign JWTs with the same `_SECRET_KEY`.
4. **Passwords in the subscription service are AES-encrypted (reversible), not bcrypt-hashed** — credentials are compared by decrypting and comparing plaintext.
5. **Schema drift:** `subscription/migrations/subscription` is an older snapshot of the tenant schema than `server/migrations/create`; newly provisioned tenants may lack newer columns/tables until the accounting server migrates them.
6. **Periodic stale query patterns** in dashboard controllers (`'PARTIAL'`) and enums that changed over migrations (`PARTIALLY_PAID` → `PARTIALLY PAID`).
7. **The audit_trail `down()` migration is a no-op** (table is never dropped on rollback). Trigger SQL folders are empty placeholders.
8. **Swagger** currently documents only a few Purchase Order endpoints in `server/src/docs/swagger.docs.yaml` (the server anyway); the subscription service's swagger YAML is an empty stub without paths.
9. **Notifications bell** in the header is static (no backend feed).
10. **`tax_forms`** and partial-payment columns (`s_paid_amount`, `c_collected_amount`, `c_paid_amount`, CANCELLED states) exist only in the server migration set — features like partial-payment recompute logic are code-level, not DB-trigger level.
11. **CSV/Excel are client-side**: reports export with `xlsx` in the browser; `exceljs` is a dependency but unused; server has no spreadsheet export.
12. **WebSockets are global** (broadcast to every client, no per-tenant-room isolation; clients filter by event type). No auto-reconnect library.
13. **`tax_account` in withholding_tax** doubles as the BIR ATC code surfaced in tax compliance output.
14. **Collection/payment items were migrated to reference invoices instead of line items** (`ci_sales_id` → `sales`, `ci_purchase_id` → `purchase`), enabling partial payments at the invoice level.

---

## 18. COMMANDS

Run at repo root (`cd D:\5L_SYSTEMS\accounting_system`):

```bash
npm run dev:server      # start accounting API server (nodemon)
npm run dev:client      # start Vite React client
npm run migrate         # migrate admin/tenant default DB + regenerate models
npm run migrate:all     # migrate ALL tenant DBs listed in admin master_user
npm run migrate:tenant -- --db=<tenantDb>   # migrate one tenant
npm run seed            # seed default DB
npm run seed:all        # seed all tenants
npm run db:setup        # create db + migrate + seed + regenerate models/schema
npm run db:status       # migration status report (umzug)
npm run db:reset        # drop + create + migrate + seed (dangerous)
npm run db:create       # create default DB
npm run migrate:undo    # undo last migration
npm run migration:create -- <name>   # scaffold a new migration
npm run seeder:create -- <name>      # scaffold a new seeder
npm run bump:patch|minor|major       # version bump + sync client/server versions
```

Start the subscription service separately:
```bash
cd subscription
npm install   # note: subscription is NOT an npm workspace; install standalone
npm run dev   # or: npm start / node server.js
```

All commands load `.env` from the repo root via `dotenv -e .env`.

---

## 19. ENVIRONMENT VARIABLES (from .sample.env)

**Database / server**
- `_HOST_ADMIN`, `_USER_ADMIN`, `_PASSWORD_ADMIN` (AES-encrypted), `_DATABASE_ADMIN`, `_DB_PORT`
- `_SERVER_URL`, `_SERVER_PORT`
- `_SUBSCRIPTION_SERVER_PORT`
- `_MAIN_SERVER_URL`, `_MAIN_SERVER_PORT`

**Client / CORS**
- `_CLIENT_URL`, `_CLIENT_PORT`, `_CORS_ORIGINS`
- `VITE_SERVER_LINK`, `VITE_SUBSCRIPTION_LINK`, `VITE_SUBSCRIPTION_URL`, `VITE_SUBSCRIPTION_PORT`

**MongoDB (sessions + tenant mapping)**
- `_MONGODB_URL`, `_SESSION_COLLECTION`, `_SUBSCRIPTION_MONGODB_URL`, `_SUBSCRIPTION_SESSION_COLLECTION`
- `_SESSION_SECRET`, `_HTTPS_SECURE`, cookie name `_SESSION_COLLECTION`

**Auth / crypto**
- `_SECRET_KEY` (JWT, shared between services)
- `_ENCRYPTION_ALGORITHM`, `_ENCRYPTION_IV`, `_ENCRYPTION_KEY` (AES for passwords/DB creds)
- `_DEFAULT_API_TOKEN`, `_ALLOW_DEFAULT_TOKEN`, `_DEFAULT_API_USER`, `_DEFAULT_TENANT_DB` (dev bypass)

**Other**
- `NODE_ENV`, `_SWAGGER_USER`, `_SWAGGER_PASS`
- `_EMAIL_HOST`, `_EMAIL_PORT`, `_EMAIL_USER`, `_EMAIL_PASSWORD`, `_EMAIL_FROM`, `_EMAIL_TO`
- `PAYMONGO_SECRET_KEY`
- `_INVENTORY_PRODUCT_URL`, `_INVENTORY_API_KEY` (external inventory integration hook)
- `VITE_OCR_API` (OCR service hook)

---

*Generated as an index so you can ask any AI questions about behavior, architecture, schema, flows, or debugging without uploading the repo.*