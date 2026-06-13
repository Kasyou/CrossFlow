import initSqlJs, { Database as SqlJsDatabase, Statement, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import migration001 from './migrations/001_initial';
import migration002 from './migrations/002_fee_tables';
import migration003 from './migrations/003_finance_tables';
import migration004 from './migrations/004_procurement';
import migration005 from './migrations/005_reviews';
import migration006 from './migrations/006_users';
import migration007 from './migrations/007_freight';
import migration008 from './migrations/008_platform_mode';
import migration009 from './migrations/009_add_indexes';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  { version: 1, name: 'initial_schema', sql: migration001 },
  { version: 2, name: 'fee_tables', sql: migration002 },
  { version: 3, name: 'finance_tables', sql: migration003 },
  { version: 4, name: 'procurement', sql: migration004 },
  { version: 5, name: 'reviews', sql: migration005 },
  { version: 6, name: 'users', sql: migration006 },
  { version: 7, name: 'freight', sql: migration007 },
  { version: 8, name: 'platform_mode', sql: migration008 },
  { version: 9, name: 'add_indexes', sql: migration009 },
];

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let dbPath = '';

async function getSQL(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => {
        // In packaged Electron app, WASM is in extraResources
        const resourcePath = path.join(process.resourcesPath || '', 'sql-wasm', file);
        if (fs.existsSync(resourcePath)) return resourcePath;
        // Fallback: same directory as JS bundle or node_modules
        return file;
      },
    });
  }
  return SQL;
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (!db) {
    dbPath = path.join(app.getPath('userData'), 'crossflow.db');
    const sql = await getSQL();
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new sql.Database(buffer);
    } else {
      db = new sql.Database();
    }
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    const tmpPath = dbPath + '.tmp';
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, dbPath);
  }
}

let saveTimer: NodeJS.Timeout | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDb, 5000);
}

function getAppliedVersions(database: SqlJsDatabase): Set<number> {
  database.run(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const results: number[] = [];
  database.exec('SELECT version FROM _migrations ORDER BY version');
  // sql.js exec returns array of { columns, values }
  const stmt = database.prepare('SELECT version FROM _migrations ORDER BY version');
  while (stmt.step()) {
    results.push(stmt.getAsObject().version as number);
  }
  stmt.free();
  return new Set(results);
}

export async function runMigrations(): Promise<void> {
  const database = await getDb();
  const applied = getAppliedVersions(database);

  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    console.log(`Running migration ${m.version}: ${m.name}`);
    database.run(m.sql);
    database.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
    saveDb();
  }
}

export function closeDb(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveDb();
  if (db) {
    db.close();
    db = null;
  }
}

// Wrapper emulating better-sqlite3's synchronous API on top of sql.js
class PreparedStatement {
  private stmt: Statement;
  private isSelect: boolean;

  constructor(stmt: Statement) {
    this.stmt = stmt;
    this.isSelect = stmt.getColumnNames().length > 0;
  }

  all(...params: unknown[]): any[] {
    if (params.length > 0) this.stmt.bind(params);
    const results: Record<string, unknown>[] = [];
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.free();
    return results;
  }

  get(...params: unknown[]): any {
    if (params.length > 0) this.stmt.bind(params);
    let result: Record<string, unknown> | undefined;
    if (this.stmt.step()) {
      result = this.stmt.getAsObject();
    }
    this.stmt.free();
    return result;
  }

  run(...params: unknown[]): void {
    if (params.length > 0) this.stmt.bind(params);
    this.stmt.step();
    this.stmt.free();
    scheduleSave();
  }
}

class DatabaseWrapper {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.run(sql);
    scheduleSave();
  }

  transaction<T extends (db: DatabaseWrapper) => void>(fn: T): void {
    this.db.run('BEGIN');
    try {
      fn(this);
      this.db.run('COMMIT');
      scheduleSave();
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }
}

let dbWrapper: DatabaseWrapper | null = null;

export function getDbSync(): DatabaseWrapper {
  if (!dbWrapper) {
    if (!db) throw new Error('Database not initialized. Call runMigrations() first.');
    dbWrapper = new DatabaseWrapper(db);
  }
  return dbWrapper;
}

export async function initDatabase(): Promise<void> {
  await getDb();
  if (!dbWrapper && db) {
    dbWrapper = new DatabaseWrapper(db);
  }
}
