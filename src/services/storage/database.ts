import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { dirname } from "node:path";

import { DATABASE_PATH } from "./model";

export function initializeDatabase(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS Tasks (
      id INTEGER PRIMARY KEY,
      task TEXT NOT NULL,
      section INTEGER NOT NULL CHECK (section IN (0, 1, 2)),
      extras TEXT NOT NULL DEFAULT '{}'
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS SyncLinks (
      taskId INTEGER NOT NULL,
      provider TEXT NOT NULL,
      remoteListId TEXT NOT NULL,
      remoteId TEXT NOT NULL,
      fingerprint TEXT,
      PRIMARY KEY (taskId, provider)
    )
  `);

  // Databases created before `planos sync` lack the fingerprint column.
  const syncLinkColumns = database.query("PRAGMA table_info(SyncLinks)").all() as { name: string }[];
  if (!syncLinkColumns.some(column => column.name === "fingerprint")) {
    database.run("ALTER TABLE SyncLinks ADD COLUMN fingerprint TEXT");
  }
}

export function openDatabase(path = DATABASE_PATH): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.run("PRAGMA busy_timeout = 5000");
  initializeDatabase(database);
  return database;
}
