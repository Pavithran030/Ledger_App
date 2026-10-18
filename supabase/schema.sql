-- Supabase Cloud Schema for Cattle Feed Mill Credit Ledger
-- Mirrors SQLite schema with owner_id and Row Level Security (RLS)
--
-- Safe to run repeatedly on an existing database:
--   * tables use CREATE TABLE IF NOT EXISTS
--   * every policy is dropped before being re-created (fixes error 42710)
--   * owner_id is forced nullable so rows can be pushed with the anon key
--     (older versions of this schema had "DEFAULT auth.uid() NOT NULL").

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT,
  village TEXT,
  credit_limit_paise BIGINT DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customers ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own customers" ON customers;
CREATE POLICY "Users can only access own customers" ON customers
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  name_ta TEXT,
  unit TEXT NOT NULL DEFAULT 'bag',
  stock_qty NUMERIC NOT NULL DEFAULT 0,
  low_stock_alert NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE products ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own products" ON products;
CREATE POLICY "Users can only access own products" ON products
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 3. Price History Table
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  price_paise BIGINT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE price_history ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE price_history ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own price history" ON price_history;
CREATE POLICY "Users can only access own price history" ON price_history
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 4. Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  bill_no BIGINT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  type TEXT NOT NULL CHECK (type IN ('cash', 'credit')),
  bill_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  total_paise BIGINT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bills ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE bills ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own bills" ON bills;
CREATE POLICY "Users can only access own bills" ON bills
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 5. Bill Items Table
CREATE TABLE IF NOT EXISTS bill_items (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  bill_id TEXT NOT NULL REFERENCES bills(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty NUMERIC NOT NULL,
  price_paise BIGINT NOT NULL,
  amount_paise BIGINT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bill_items ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE bill_items ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own bill items" ON bill_items;
CREATE POLICY "Users can only access own bill items" ON bill_items
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  pay_date TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own payments" ON payments;
CREATE POLICY "Users can only access own payments" ON payments
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);

-- 7. Stock Moves Table
CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_change NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_moves ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE stock_moves ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own stock moves" ON stock_moves;
CREATE POLICY "Users can only access own stock moves" ON stock_moves
  FOR ALL USING (auth.uid() = owner_id OR owner_id IS NULL);
