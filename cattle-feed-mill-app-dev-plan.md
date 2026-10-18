# Cattle Feed Mill Credit Ledger App — Full Development Plan (Expo)

A mobile app for a cattle feed mill: cash sales, credit sales with price locked per bill, customer part-payments, feed stock, reports, and free WhatsApp sharing. Built only on free tiers and open-source tools.

---

## 1. Goals

| Problem | Solution |
|---|---|
| Prices change unevenly | Price history table. Each bill item stores the price at the moment of sale. Old bills never change. |
| Credit customers pay later | Credit bills add to balance. |
| Customers pay part amounts | Payments are separate entries that reduce balance. Advance shows as negative balance. |
| Notebook is error-prone | Balance is always calculated, never typed. |
| WhatsApp updates are manual | One-tap `wa.me` message with balance, recent bills and payments. Free. |
| Poor network at the mill | Offline-first. Local SQLite is the main database, cloud sync is a bonus. |

---

## 2. Tech Stack (all free)

| Layer | Choice |
|---|---|
| App | Expo SDK (latest stable), TypeScript, Expo Router |
| UI | NativeWind (Tailwind) + custom large-button components |
| Local DB | `expo-sqlite` (primary data store) |
| Data access | Plain SQL in a repository layer (or Drizzle ORM if preferred) |
| State | Zustand (light UI state only) |
| Cloud sync and backup | Supabase free tier (Postgres + Auth) |
| Secure storage / PIN | `expo-secure-store`, `expo-local-authentication` |
| PDF statements | `expo-print` + `expo-sharing` |
| WhatsApp | `Linking.openURL("https://wa.me/...")` |
| CSV export / backup | `expo-file-system` + `expo-sharing` |
| i18n (English + Tamil) | `i18next`, `react-i18next`, `expo-localization` |
| Dates | `date-fns` |
| Validation | `zod` |
| Tests | Jest + `jest-expo` |
| Build | `eas build --profile preview --platform android` (free tier has a monthly build limit), or free local build with `npx expo run:android` / `eas build --local` |
| Distribution | Share the APK directly (no Play Store fee needed) |

Cautions:

- Supabase free projects pause after about a week of no activity. Use the app regularly, or add a scheduled GitHub Actions ping.
- Free tier has no guaranteed backups. Keep the weekly CSV export feature.
- Test in Expo Go during development. Move to a development build only if a library needs it.

---

## 3. Core Business Rules (never break these)

1. Money is stored as integer paise (₹1 = 100). No floating point for money.
2. Quantity may be decimal (kg, bags). Line amount = round(qty × price_paise).
3. Prices are never edited. A new row is added to `price_history` with an effective date.
4. A bill item copies the price at the time of the sale and keeps it forever.
5. The price on a bill item can be manually overridden for special customers.
6. Customer balance = sum of active credit bills − sum of active payments. Never stored, always calculated.
7. Nothing is hard-deleted. Mistakes are cancelled (`status = 'cancelled'`) and stay visible.
8. Cash bills do not affect any customer balance but do reduce stock.
9. Every credit bill and payment checks the credit limit and warns (does not block unless the owner chooses).
10. All primary keys are UUIDs generated on the device so offline records can sync without conflicts.

---

## 4. Database Schema (SQLite)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,                 -- digits with country code, e.g. 919876543210
  village TEXT,
  credit_limit_paise INTEGER DEFAULT 0,   -- 0 = no limit
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ta TEXT,               -- Tamil name (optional)
  unit TEXT NOT NULL DEFAULT 'bag',       -- bag | kg | litre | packet
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_alert REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  price_paise INTEGER NOT NULL,
  effective_from TEXT NOT NULL,           -- ISO datetime
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX idx_price_product_date ON price_history(product_id, effective_from DESC);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  bill_no INTEGER NOT NULL,               -- running number
  customer_id TEXT REFERENCES customers(id),  -- NULL for walk-in cash
  type TEXT NOT NULL CHECK (type IN ('cash','credit')),
  bill_date TEXT NOT NULL,
  due_date TEXT,
  total_paise INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | cancelled
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty REAL NOT NULL,
  price_paise INTEGER NOT NULL,           -- locked price at time of sale
  amount_paise INTEGER NOT NULL,
  synced_at TEXT
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  pay_date TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash',      -- cash | upi | bank | other
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE stock_moves (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_change REAL NOT NULL,               -- + purchase/adjust, - sale
  reason TEXT NOT NULL,                   -- sale | purchase | adjust | cancel
  ref_id TEXT,                            -- bill id etc.
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Key queries

```sql
-- Current price of a product (as of now)
SELECT price_paise FROM price_history
WHERE product_id = ? AND effective_from <= ?
ORDER BY effective_from DESC, created_at DESC LIMIT 1;

-- Customer balances (positive = customer owes mill)
SELECT c.id, c.name, c.phone,
  COALESCE((SELECT SUM(total_paise) FROM bills
            WHERE customer_id = c.id AND type='credit' AND status='active'), 0)
- COALESCE((SELECT SUM(amount_paise) FROM payments
            WHERE customer_id = c.id AND status='active'), 0) AS balance_paise
FROM customers c
WHERE c.status = 'active'
ORDER BY balance_paise DESC;

-- Customer ledger (bills and payments merged, oldest first)
SELECT 'bill' AS kind, id, bill_date AS date, total_paise AS amount_paise, bill_no AS ref
FROM bills WHERE customer_id = ? AND type='credit' AND status='active'
UNION ALL
SELECT 'payment', id, pay_date, amount_paise, NULL
FROM payments WHERE customer_id = ? AND status='active'
ORDER BY date ASC;
```

Running balance is computed in code while walking the merged ledger.

---

## 5. Project Structure

```
app/
  _layout.tsx
  (auth)/pin.tsx
  (tabs)/
    index.tsx            # Home dashboard
    sale.tsx             # New sale
    customers.tsx        # Customer list
    products.tsx         # Products and prices
    reports.tsx
  customer/[id].tsx      # Ledger + Add Payment + WhatsApp
  customer/new.tsx
  product/[id].tsx       # Price history + Update price
  bill/[id].tsx
  settings.tsx
src/
  db/ (client.ts, migrations.ts, repositories/*.ts)
  services/ (balance.ts, pricing.ts, whatsapp.ts, pdf.ts, csv.ts, sync.ts)
  components/ (BigButton, MoneyText, AmountInput, CustomerCard, ...)
  i18n/ (en.json, ta.json)
  utils/ (money.ts, dates.ts)
  __tests__/
AGENTS.md                # master context for the AI agent (Section 8)
```

---

## 6. Screens and Behaviour

1. **PIN lock:** 4-digit PIN stored in secure store, optional fingerprint.
2. **Home:** today's cash total, today's credit total, payments received today, total pending, low-stock list, overdue customers.
3. **New Sale:**
   - Toggle Cash / Credit. Credit requires a customer (searchable).
   - Add items: product picker, qty, price auto-filled from current price (editable), live line total.
   - Shows customer's current balance and credit-limit warning.
   - Save: creates bill, items, stock moves in one transaction. Then offers "Send on WhatsApp" / "Share PDF".
4. **Customers:** search, balance shown in large text, sort by highest pending, quick add.
5. **Customer page:**
   - Header: name, phone, balance.
   - Ledger list with running balance.
   - Buttons: **Add Payment**, **New Credit Bill**, **Send Balance on WhatsApp**, **Share Statement PDF**.
   - Add Payment: amount, mode, date, note. Shows balance after payment. Offers receipt on WhatsApp.
6. **Products:** list with current price and stock. Product page has **Update Price** (new price + effective date) and the full price history. Also stock purchase entry and adjustment.
7. **Reports:** daily and monthly summary (cash, credit, payments, pending), pending customers list, product-wise sales, CSV export.
8. **Settings:** mill name and phone (for message footer), language (English/Tamil), PIN, backup/export, sync status.

### UX rules

- Large touch targets (min 48dp), high contrast, big rupee amounts.
- Minimal typing: number pad for amounts, search pickers, recent customers on top.
- Confirm before cancelling any bill or payment.
- Works fully offline with no visible errors.

---

## 7. WhatsApp Message Templates

Build in `src/services/whatsapp.ts`. Number must be digits only with country code (91 for India).

```ts
const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
Linking.openURL(url);
```

Balance message (English):

```
Hello {name},
Your pending amount at {mill}: ₹{balance}

Recent bills:
{date} - Bill #{no} - ₹{amount}
Recent payments:
{date} - ₹{amount} ({mode})

Thank you.
```

Payment receipt:

```
Hello {name}, we received ₹{amount} on {date}. Your balance is now ₹{balance}. Thank you. - {mill}
```

Provide Tamil versions of both, chosen by a per-customer or global language setting.

---

## 8. Master Context File for the AI Agent (save as `AGENTS.md` or `CLAUDE.md` in the project root)

```text
# Project: Cattle Feed Mill Credit Ledger (Expo, TypeScript)

## Purpose
Offline-first mobile app for a cattle feed mill owner. Cash sales, credit sales,
customer part-payments, stock, reports, free WhatsApp sharing via wa.me links.

## Stack
Expo (latest stable SDK), TypeScript strict, Expo Router, NativeWind, expo-sqlite,
Zustand, zod, date-fns, i18next (English + Tamil), expo-print, expo-sharing,
expo-file-system, expo-secure-store, expo-local-authentication, Supabase (sync only).

## Non-negotiable business rules
1. Money is integer paise. Never use floats for money. Format only in the UI.
2. Prices are never edited. Add a new price_history row. Bill items copy the price
   at sale time and it never changes afterward.
3. Customer balance = sum(active credit bills) - sum(active payments). Always
   calculated from rows, never stored or typed.
4. Never hard-delete bills, payments or stock moves. Cancel them (status='cancelled')
   and reverse stock with a stock_move.
5. Every multi-table write (bill + items + stock moves) runs in one SQLite transaction.
6. IDs are UUIDs generated on device. All tables have created_at/updated_at ISO strings.
7. The app must work fully offline. Sync is optional and must never block the UI.
8. UI: large buttons (>=48dp), high contrast, minimal typing, English + Tamil labels
   via i18n keys (no hard-coded strings in components).

## Conventions
- Database access only through src/db/repositories/*. Components never write SQL.
- Business logic in src/services/*, pure and unit-tested.
- Small files, named exports, functional components, no `any`.
- Every service function that touches money or balance has Jest tests.
- After each task: run `npx tsc --noEmit` and `npm test`, fix errors, then summarize
  what changed and what to test manually.

## Do not
- Add paid services or paid APIs.
- Add libraries without stating why and checking they work in Expo Go or a dev build.
- Change the schema without adding a numbered migration.
```

---

## 9. Phase-by-Phase Agent Prompts

Use one prompt per session. After each phase: run the app, test manually, commit to Git, then continue.

### Phase 0 — Project setup

```text
Read AGENTS.md first. Create a new Expo project with TypeScript and Expo Router
in this folder. Install and configure: NativeWind, expo-sqlite, zustand, zod,
date-fns, i18next, react-i18next, expo-localization, expo-secure-store,
expo-local-authentication, expo-print, expo-sharing, expo-file-system, uuid
(use expo-crypto randomUUID if possible). Set up the folder structure from the
plan (app/, src/db, src/services, src/components, src/i18n, src/utils,
src/__tests__). Configure Jest with jest-expo, ESLint, Prettier, and strict
TypeScript. Create a tab layout with 5 placeholder tabs: Home, Sale, Customers,
Products, Reports. Make sure `npx expo start` runs and `npx tsc --noEmit` passes.
Initialize Git with a sensible .gitignore. Do not build any features yet.
```

### Phase 1 — Database, migrations, utils

```text
Implement the SQLite layer using expo-sqlite. Create src/db/client.ts (open DB,
enable foreign keys) and src/db/migrations.ts with a numbered migration runner
(a schema_version table). Migration 1 must create exactly these tables:
customers, products, price_history, bills, bill_items, payments, stock_moves,
settings, using the schema in the plan document (paste it from the plan if
available). Create src/utils/money.ts (rupeesToPaise, paiseToRupees,
formatINR with Indian grouping like 1,25,000) and src/utils/dates.ts.
Create repositories with typed functions: customersRepo (create, update, list,
archive, getById, search), productsRepo (create, update, list), pricesRepo
(addPrice, getCurrentPrice(productId, atDate), history). Write Jest tests for
money utils and getCurrentPrice (price changes over time return the right
price for a given date). Keep UI untouched.
```

### Phase 2 — Customers and Products screens

```text
Build the Customers and Products features with the repositories from Phase 1.
Customers tab: searchable list, floating "Add customer" button, create/edit form
(name required, phone validated to 10 digits and stored as 91XXXXXXXXXX,
village, credit limit in rupees). Products tab: list showing current price and
stock, create product (name, Tamil name, unit, opening stock, first price),
product detail page with "Update price" (new price + effective date, adds a
price_history row, never edits old ones) and a price history list. Add reusable
components: BigButton, AmountInput (number pad, rupees), MoneyText, EmptyState,
SearchBar. All text via i18n keys with en.json and ta.json (provide Tamil
translations). Use zod for form validation. Large touch targets and clear layout.
```

### Phase 3 — Sales (cash and credit) with price lock and stock

```text
Implement the New Sale flow. Create billsRepo.createBill that, in ONE SQLite
transaction, inserts the bill (auto-incrementing bill_no), its bill_items (copy
the current price_paise at sale time, allow manual override per item), and
negative stock_moves, and updates products.stock_qty. Create billsRepo.cancelBill
that marks the bill cancelled and writes reversing stock_moves. Build the Sale
screen: Cash/Credit toggle, customer picker (required for credit, shows current
balance and credit-limit warning), add-item sheet (product, qty, price prefilled
and editable, live line total), item list with remove, grand total, due date for
credit, Save. Warn when stock goes negative or credit limit is exceeded (allow
override with confirmation). After saving, show a bill detail page with
"Cancel bill" (confirm dialog). Write Jest tests proving: (1) changing a
product's price after a sale does not change the old bill item, (2) cancelling a
bill restores stock, (3) totals use integer paise rounding correctly.
```

### Phase 4 — Payments and customer ledger

```text
Implement payments and the customer ledger. Create paymentsRepo (add, cancel,
listByCustomer). Create src/services/balance.ts with: getCustomerBalance,
getAllBalances (customers sorted by highest balance), and getLedger(customerId)
that merges active credit bills and active payments by date and returns a
running balance per row. Build customer/[id].tsx: header with name, phone and a
large balance (red if customer owes, green if zero, blue if advance/negative),
the ledger list with running balance, and buttons Add Payment, New Credit Bill.
Add Payment modal: amount, mode (cash/UPI/bank/other), date, note, and a preview
"Balance after payment". Allow payment greater than balance (becomes advance).
Support cancelling a payment with confirmation. Write Jest tests: part-payment
reduces balance, multiple payments, overpayment gives negative balance,
cancelled bill/payment excluded, running balance order is correct.
```

### Phase 5 — WhatsApp, PDF statement, receipts

```text
Implement src/services/whatsapp.ts: buildBalanceMessage(customer, balance,
recentBills, recentPayments, millSettings, language) and buildReceiptMessage,
using the templates in the plan (English and Tamil). openWhatsApp(phone, message)
uses Linking.openURL with https://wa.me/<phone>?text=<encodeURIComponent>;
handle failure with a friendly error. Add "Send balance on WhatsApp" to the
customer page and "Send receipt" after adding a payment and after saving a
credit bill. Implement src/services/pdf.ts to generate an HTML-to-PDF customer
statement (mill name, customer, date range, ledger with running balance, final
balance) with expo-print and share it with expo-sharing. Add a Settings screen
with mill name, mill phone and language. Unit test the message builders
(snapshot tests for both languages).
```

### Phase 6 — Home dashboard and Reports

```text
Build the Home tab and Reports tab with efficient SQL in src/services/reports.ts:
today's cash sales, today's credit sales, payments received today, total pending
across customers, low-stock products, overdue customers (credit bills past
due_date with a positive balance), top 5 pending customers. Reports tab: pick
day or month; show cash vs credit vs payments, product-wise quantity and amount
sold, and a pending customers list. Add CSV export of customers+balances, bills
and payments using expo-file-system and expo-sharing. Use simple charts only if
they work in Expo Go without extra native setup; otherwise use clean number
cards. Add Jest tests for the report queries using an in-memory/mocked DB layer
or pure functions.
```

### Phase 7 — Security, backup, polish

```text
Add a PIN lock screen (4 digits stored hashed in expo-secure-store) with
optional biometric unlock via expo-local-authentication, locking when the app
returns from background after 1 minute. Add a Settings > Backup section that
exports the whole database as a JSON file and imports (restore) from it with a
confirmation and validation. Add an automatic reminder banner if the last backup
is older than 7 days. Improve UX: pull-to-refresh, loading and empty states,
haptic feedback on save, keyboard-safe forms, consistent error toasts, dark text
on light background with high contrast. Review all screens for 48dp targets and
that no hard-coded strings remain outside i18n. Run tsc, lint and tests.
```

### Phase 8 — Optional cloud sync (Supabase free tier)

```text
Add optional sync to Supabase. Create a SQL file supabase/schema.sql mirroring
the local tables (UUID text ids, same columns) with Row Level Security so each
user only accesses rows where owner_id = auth.uid(); add an owner_id column on
every table. Implement email+password login (Supabase Auth). Implement
src/services/sync.ts as a simple, safe push/pull: push all rows where
synced_at IS NULL or updated_at > synced_at (upsert by id), then pull rows with
updated_at greater than the last pull timestamp and upsert locally (last-write-
wins by updated_at). Because bills, payments and price_history are effectively
append-only, conflicts should be rare. Run sync on app start, after saves (debounced), and via a
manual "Sync now" button; never block the UI and show last sync time. Keep
the app 100% usable if the user never logs in. Document env setup
(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY) in README. Add a
note about free-tier project pausing and a GitHub Actions workflow that pings
the project weekly.
```

### Phase 9 — Build and release

```text
Prepare the app for release. Configure app.json (name, slug, package id, icon,
adaptive icon, splash), set version, and add eas.json with a "preview" profile
that builds an Android APK. Provide step-by-step commands for: eas login,
eas build --profile preview --platform android, and the free alternative of a
local build (npx expo prebuild then ./gradlew assembleRelease or
eas build --local). Write a README with install instructions for the mill
owner (how to install the APK, set PIN, first-time setup: add products with
prices, add customers, opening balances). Add a feature "Opening balance" per
customer that creates a special credit entry dated today, so existing notebook
balances can be entered once. Final check: run tsc, lint, tests and list a
manual test checklist.
```

---

## 10. Reusable Prompts for Day-to-Day Agent Work

**Bug fix**

```text
Read AGENTS.md. Bug: <describe what you did, what you expected, what happened>.
First find the root cause by reading the relevant code and writing a failing Jest
test if the bug is in logic. Then fix it with the smallest change, keep money in
integer paise, run tsc and tests, and explain the cause in 3 lines.
```

**New feature**

```text
Read AGENTS.md. Feature: <describe>. Before coding, list the files you will
change and any schema migration needed, then implement it following the
conventions. Add tests for any logic touching money, balance or stock. Run tsc
and tests and tell me how to test it manually.
```

**Code review**

```text
Read AGENTS.md. Review the current diff against the non-negotiable business
rules: integer paise, no editing of prices, balance always calculated, no hard
deletes, transactions for multi-table writes, offline-first, i18n for all text.
List violations by severity and fix them.
```

**Schema change**

```text
Read AGENTS.md. I need to add <column/table>. Create a new numbered migration
(never edit migration 1), update repositories and types, keep old data intact,
and add a test that migrates a DB from the previous version.
```

---

## 11. Manual Test Checklist

1. Add feed item "Cattle Feed Pellets" at ₹1,200. Add customer "Murugan" with 10-digit phone.
2. Credit sale: 5 bags to Murugan. Balance = ₹6,000. Stock reduced by 5.
3. Change Cattle Feed Pellets price to ₹1,350. Open the old bill: still ₹1,200 per bag.
4. New credit sale of 2 bags: ₹2,700. Balance = ₹8,700.
5. Add payment ₹3,000 (UPI). Balance = ₹5,700. Ledger running balance correct.
6. Pay ₹6,000 more. Balance = −₹300 (advance), shown clearly.
7. Cancel the last payment. Balance returns to ₹5,700.
8. Cancel the second bill. Stock restored, balance updates.
9. Send balance on WhatsApp: opens WhatsApp with correct number and message.
10. Cash sale to walk-in: stock reduces, no customer balance affected.
11. Airplane mode: complete a sale and a payment. Everything works.
12. Export CSV and JSON backup. Restore backup on a fresh install.
13. Switch language to Tamil: all screens translate.
14. Lock and unlock with PIN.

---

## 12. Suggested Timeline

| Week | Phases |
|---|---|
| 1 | 0, 1, 2 |
| 2 | 3, 4 |
| 3 | 5, 6 |
| 4 | 7, 9 (build APK), start real use |
| 5+ | 8 (sync) once the local app is stable |

Run the app alongside the notebook for two weeks with about 5 real customers before fully switching.

---

## 13. Tips for Working with the AI Agent

- Always point the agent to `AGENTS.md` at the start of a session.
- One phase per session. Commit to Git after each working phase.
- Ask for tests on every money, balance and stock function. These are where silent mistakes hurt most.
- If the agent suggests a paid service or a package that does not work in Expo, ask for a free alternative.
- Review the migration and transaction code yourself. Data integrity matters more than looks.
