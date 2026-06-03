import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let db: SqlJsDatabase;

async function newDb() {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run(`CREATE TABLE inventory (
    id TEXT PRIMARY KEY, product_id TEXT, warehouse_id TEXT,
    available INTEGER DEFAULT 0, reserved INTEGER DEFAULT 0, in_transit INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE product (
    id TEXT PRIMARY KEY, sku TEXT, name TEXT, safety_stock INTEGER DEFAULT 10
  )`);
  // Seed data
  db.run("INSERT INTO inventory VALUES ('inv1', 'p1', 'w1', 100, 0, 0)");
  db.run("INSERT INTO product VALUES ('p1', 'SKU-001', 'Test', 10)");
}

function execOne(sql: string): any[] | null {
  const r = db.exec(sql);
  if (r.length === 0 || r[0].values.length === 0) return null;
  return r[0].values[0];
}

// Core business logic: reserve stock
function reserve(pId: string, wId: string, qty: number) {
  const row = execOne(`SELECT id, available, reserved FROM inventory WHERE product_id = '${pId}' AND warehouse_id = '${wId}'`);
  if (!row) throw new Error('Not found');
  const [id, available, reserved] = row;
  db.run('UPDATE inventory SET available = ?, reserved = ? WHERE id = ?',
    [available - qty, reserved + qty, id]);
}

function release(pId: string, wId: string, qty: number) {
  const row = execOne(`SELECT id, available, reserved FROM inventory WHERE product_id = '${pId}' AND warehouse_id = '${wId}'`);
  if (!row) throw new Error('Not found');
  const [id, available, reserved] = row;
  db.run('UPDATE inventory SET available = ?, reserved = ? WHERE id = ?',
    [available + qty, Math.max(0, reserved - qty), id]);
}

function isLowStock(sku: string): boolean {
  const row = execOne(
    `SELECT i.available, p.safety_stock FROM inventory i JOIN product p ON i.product_id = p.id WHERE p.sku = '${sku}'`
  );
  if (!row) return false;
  return (row[0] as number) < (row[1] as number);
}

describe('Inventory reserve/release', () => {
  beforeEach(async () => { await newDb(); });

  it('starts with 100 available', () => {
    const [available, reserved] = execOne("SELECT available, reserved FROM inventory WHERE id='inv1'")!;
    expect(available).toBe(100);
    expect(reserved).toBe(0);
  });

  it('reserve: available ↓, reserved ↑', () => {
    reserve('p1', 'w1', 5);
    const [available, reserved] = execOne("SELECT available, reserved FROM inventory WHERE id='inv1'")!;
    expect(available).toBe(95);
    expect(reserved).toBe(5);
  });

  it('reserve twice: tracks both correctly', () => {
    reserve('p1', 'w1', 5);
    reserve('p1', 'w1', 10);
    const [available, reserved] = execOne("SELECT available, reserved FROM inventory WHERE id='inv1'")!;
    expect(available).toBe(85);
    expect(reserved).toBe(15);
  });

  it('release: available ↑, reserved ↓', () => {
    reserve('p1', 'w1', 20);
    release('p1', 'w1', 8);
    const [available, reserved] = execOne("SELECT available, reserved FROM inventory WHERE id='inv1'")!;
    expect(available).toBe(88);
    expect(reserved).toBe(12);
  });

  it('release more than reserved: caps at 0', () => {
    reserve('p1', 'w1', 5);
    release('p1', 'w1', 10);
    const [available, reserved] = execOne("SELECT available, reserved FROM inventory WHERE id='inv1'")!;
    expect(available).toBe(105);  // 100 - 5 + 10 = 105
    expect(reserved).toBe(0);    // capped at 0
  });
});

describe('Safety stock alerts', () => {
  beforeEach(async () => { await newDb(); });

  it('alerts when below safety stock', () => {
    db.run("UPDATE inventory SET available = 5 WHERE id='inv1'");
    expect(isLowStock('SKU-001')).toBe(true);
  });

  it('no alert when above safety stock', () => {
    db.run("UPDATE inventory SET available = 50 WHERE id='inv1'");
    expect(isLowStock('SKU-001')).toBe(false);
  });

  it('no alert when exactly at safety stock (not below)', () => {
    db.run("UPDATE inventory SET available = 10 WHERE id='inv1'");
    expect(isLowStock('SKU-001')).toBe(false);
  });
});
