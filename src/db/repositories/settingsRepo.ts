import { getDb } from "../client";

export const settingsRepo = {
  get(key: string, defaultValue = ""): string {
    const db = getDb();
    const row = db.getFirstSync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    return row ? row.value : defaultValue;
  },

  set(key: string, value: string): void {
    const db = getDb();
    db.runSync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  },

  getAll(): Record<string, string> {
    const db = getDb();
    const rows = db.getAllSync<{ key: string; value: string }>(
      "SELECT key, value FROM settings"
    );
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  },
};
