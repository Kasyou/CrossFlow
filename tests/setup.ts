import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let SQL: any;

export async function createTestDb(): Promise<SqlJsDatabase> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');

  // Run migration
  const migrationPath = path.join(__dirname, '..', 'electron', 'db', 'migrations', '001_initial.ts');
  const migration = require(migrationPath).default;
  db.run(migration);

  return db;
}

// Mock the electron module and app.getPath for tests
export function setupTestEnv(db: SqlJsDatabase) {
  // Override the global getDbSync behavior
  (global as any).__testDb = db;
}
