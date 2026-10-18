import type { SQLiteDatabase } from "expo-sqlite";

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          village TEXT,
          credit_limit_paise INTEGER DEFAULT 0,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_ta TEXT,
          unit TEXT NOT NULL DEFAULT 'bag',
          stock_qty REAL NOT NULL DEFAULT 0,
          low_stock_alert REAL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS price_history (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id),
          price_paise INTEGER NOT NULL,
          effective_from TEXT NOT NULL,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_price_product_date ON price_history(product_id, effective_from DESC);

        CREATE TABLE IF NOT EXISTS bills (
          id TEXT PRIMARY KEY,
          bill_no INTEGER NOT NULL,
          customer_id TEXT REFERENCES customers(id),
          type TEXT NOT NULL CHECK (type IN ('cash','credit')),
          bill_date TEXT NOT NULL,
          due_date TEXT,
          total_paise INTEGER NOT NULL,
          note TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS bill_items (
          id TEXT PRIMARY KEY,
          bill_id TEXT NOT NULL REFERENCES bills(id),
          product_id TEXT NOT NULL REFERENCES products(id),
          qty REAL NOT NULL,
          price_paise INTEGER NOT NULL,
          amount_paise INTEGER NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(id),
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          pay_date TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'cash',
          note TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS stock_moves (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id),
          qty_change REAL NOT NULL,
          reason TEXT NOT NULL,
          ref_id TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        -- Initialize default settings if not exists
        INSERT OR IGNORE INTO settings (key, value) VALUES ('mill_name', 'Cattle Feed Mill');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('mill_phone', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'en');
      `);
    },
  },
  {
    version: 2,
    name: "performance_indexes_and_constraints",
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id, type, status);
        CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id, status);
        CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
        CREATE INDEX IF NOT EXISTS idx_stock_moves_product ON stock_moves(product_id);
        CREATE INDEX IF NOT EXISTS idx_customers_status_name ON customers(status, name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
      `);
    },
  },
];

/**
 * Runs all pending database migrations in sequence.
 */
export function runMigrations(db: SQLiteDatabase): void {
  // Ensure foreign keys are enabled
  db.execSync("PRAGMA foreign_keys = ON;");

  // Create schema_version table if it doesn't exist
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.getAllSync<{ version: number }>(
    "SELECT version FROM schema_version ORDER BY version ASC"
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.withTransactionSync(() => {
        migration.up(db);
        db.runSync(
          "INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)",
          [migration.version, migration.name, new Date().toISOString()]
        );
      });
    }
  }
}
