import initSqlJs, { Database as SqlJsDatabase, Statement, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import migration001 from './migrations/001_initial';

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let dbPath = '';

async function getSQL(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs();
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
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

let saveTimer: NodeJS.Timeout | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDb, 5000);
}

export async function runMigrations(): Promise<void> {
  const database = await getDb();
  database.run(migration001);
  saveDb();
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

  transaction<T extends (...args: any[]) => void>(fn: T): T {
    return ((...args: any[]) => {
      this.db.run('BEGIN');
      try {
        fn(...args);
        this.db.run('COMMIT');
        scheduleSave();
      } catch (e) {
        this.db.run('ROLLBACK');
        throw e;
      }
    }) as unknown as T;
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
