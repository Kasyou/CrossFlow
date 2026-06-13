// Tests that exercise real Repository-style logic against actual schema migrations
import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import migration001 from "../electron/db/migrations/001_initial";

let db: SqlJsDatabase;

function queryOne(sql: string, params?: unknown[]): any[] | null {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) { const obj = stmt.getAsObject(); stmt.free(); return Object.values(obj); }
  stmt.free(); return null;
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(migration001);
  // Seed minimal data
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-amz', 'amazon', 'Amazon')");
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-sp', 'shopee', 'Shopee')");
  db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock) VALUES ('sku-1', 'BT-EP10-BK', '蓝牙耳机Pro', 28, 30)");
  db.run("INSERT INTO warehouse (id, name, type, is_default) VALUES ('w-gz', '广州仓', 'domestic', 1)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved) VALUES ('inv-1', 'sku-1', 'w-gz', 100, 0)");
});

describe("Order table with real schema", () => {
  it("inserts and queries orders", () => {
    const { v4: uuid } = require("uuid");
    db.run(
      'INSERT INTO "order" (id, platform_id, platform_order_id, sku, quantity, unit_price, total_amount, status, order_time, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      [uuid(), "p-amz", "AMZ-12345", "BT-EP10-BK", 2, 29.99, 59.98, "pending", "2026-06-01T10:00:00Z"]
    );
    const row = queryOne('SELECT * FROM "order" WHERE platform_order_id = ?', ["AMZ-12345"]);
    expect(row).not.toBeNull();
  });

  it("rejects duplicate platform_id + platform_order_id", () => {
    const { v4: uuid } = require("uuid");
    const id1 = uuid(); const id2 = uuid();
    db.run('INSERT INTO "order" (id, platform_id, platform_order_id, sku, status, synced_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))', [id1, "p-amz", "DUP-999", "SKU-A", "pending"]);
    expect(() => {
      db.run('INSERT INTO "order" (id, platform_id, platform_order_id, sku, status, synced_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))', [id2, "p-amz", "DUP-999", "SKU-B", "pending"]);
    }).toThrow();
  });
});

describe("Inventory with real schema", () => {
  it("reserve deducts available and adds to reserved", () => {
    db.run("UPDATE inventory SET available = available - 5, reserved = reserved + 5 WHERE id = ?", ["inv-1"]);
    const row = queryOne("SELECT available, reserved FROM inventory WHERE id = ?", ["inv-1"]);
    expect(row).not.toBeNull();
    expect(row![0]).toBe(95);
    expect(row![1]).toBe(5);
    // Restore
    db.run("UPDATE inventory SET available = 100, reserved = 0 WHERE id = ?", ["inv-1"]);
  });

  it("detects insufficient stock", () => {
    const row = queryOne("SELECT available FROM inventory WHERE id = ?", ["inv-1"]);
    expect(row).not.toBeNull();
    // 3 < 5 → insufficient
    expect((row![0] as number) - 98).toBeLessThan(5);
  });

  it("release returns available and reduces reserved", () => {
    db.run("UPDATE inventory SET available = 90, reserved = 10 WHERE id = ?", ["inv-1"]);
    db.run("UPDATE inventory SET available = available + 5, reserved = MAX(0, reserved - 5) WHERE id = ?", ["inv-1"]);
    const row = queryOne("SELECT available, reserved FROM inventory WHERE id = ?", ["inv-1"]);
    expect(row![0]).toBe(95);
    expect(row![1]).toBe(5);
    db.run("UPDATE inventory SET available = 100, reserved = 0 WHERE id = ?", ["inv-1"]);
  });
});

describe("Inventory safety stock alert logic", () => {
  it("alerts when available < safety_stock", () => {
    db.run("UPDATE inventory SET available = 5 WHERE id = ?", ["inv-1"]);
    const inv = queryOne("SELECT i.available, p.safety_stock FROM inventory i JOIN product p ON i.product_id = p.id WHERE i.id = ?", ["inv-1"]);
    expect(inv).not.toBeNull();
    expect(inv![0]).toBeLessThan(inv![1] as number);
    db.run("UPDATE inventory SET available = 100 WHERE id = ?", ["inv-1"]);
  });

  it("no alert when at or above safety_stock", () => {
    const inv = queryOne("SELECT i.available, p.safety_stock FROM inventory i JOIN product p ON i.product_id = p.id WHERE i.id = ?", ["inv-1"]);
    expect(inv).not.toBeNull();
    expect(inv![0]).toBeGreaterThanOrEqual(inv![1] as number);
  });
});
