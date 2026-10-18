# Project: Cattle Feed Mill Credit Ledger (Expo, TypeScript)

## Purpose
Offline-first mobile app for a cattle feed mill owner. Cash sales, credit sales,
customer part-payments, feed stock, reports, free WhatsApp sharing via wa.me links.

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
