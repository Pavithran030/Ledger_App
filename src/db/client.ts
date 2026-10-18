import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLite database instance.
 * Ensures foreign keys and WAL mode are enabled, and migrations are applied.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync("cattle_feed.db");
    dbInstance.execSync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    runMigrations(dbInstance);
  }
  return dbInstance;
}

/**
 * Allows overriding the database instance for testing.
 */
export function setDb(db: SQLite.SQLiteDatabase | null): void {
  dbInstance = db;
}
