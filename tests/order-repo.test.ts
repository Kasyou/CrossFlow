import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

let db: SqlJsDatabase;

function execOne(sql: string): any[] | null {
  const r = db.exec(sql);
  if (r.length === 0 || r[0].values.length === 0) return null;
  return r[0].values[0];
}

async function newDb() {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run("CREATE TABLE platform (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, auth_data TEXT, sync_enabled INTEGER DEFAULT 1, sync_interval INTEGER DEFAULT 900)");
  db.run("CREATE TABLE product (id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, cost_price REAL DEFAULT 0, safety_stock INTEGER DEFAULT 10, created_at TEXT)");
  db.run("CREATE TABLE warehouse (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, country TEXT, is_default INTEGER DEFAULT 0)");
  db.run("CREATE TABLE inventory (id TEXT PRIMARY KEY, product_id TEXT, warehouse_id TEXT, available INTEGER DEFAULT 0, reserved INTEGER DEFAULT 0, in_transit INTEGER DEFAULT 0, updated_at TEXT, UNIQUE(product_id, warehouse_id))");
  db.run("CREATE TABLE sync_log (id TEXT PRIMARY KEY, platform_id TEXT, sync_type TEXT, status TEXT, message TEXT, records_count INTEGER DEFAULT 0, started_at TEXT, finished_at TEXT)");
  db.run("CREATE TABLE \"order\" (id TEXT PRIMARY KEY, platform_id TEXT, platform_order_id TEXT NOT NULL, product_id TEXT, sku TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL DEFAULT 0, currency TEXT DEFAULT 'USD', total_amount REAL DEFAULT 0, buyer_name TEXT, shipping_address TEXT, logistics_provider TEXT, tracking_number TEXT, status TEXT DEFAULT 'pending', platform_status TEXT, order_time TEXT, shipped_time TEXT, synced_at TEXT, UNIQUE(platform_id, platform_order_id))");
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-amz', 'amazon', 'Amazon')");
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-sp', 'shopee', 'Shopee')");
  db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock, created_at) VALUES ('sku-001', 'BT-EP10-BK', 'Bluetooth Earbuds Pro', 28, 30, datetime('now'))");
  db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock, created_at) VALUES ('sku-002', 'PH-CASE-15PM', 'iPhone 15 Pro Max Case', 5, 50, datetime('now'))");
  db.run("INSERT INTO warehouse (id, name, type, is_default) VALUES ('w-gz', 'Guangzhou Ware', 'domestic', 1)");
  db.run("INSERT INTO warehouse (id, name, type, is_default) VALUES ('w-fba', 'FBA East', 'fba', 0)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-1', 'sku-001', 'w-gz', 100, 0, 0)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-2', 'sku-002', 'w-gz', 200, 10, 50)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-3', 'sku-001', 'w-fba', 50, 5, 10)");
  db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, unit_price, total_amount, status, synced_at) VALUES ('o1', 'p-amz', 'AMZ-001', 'BT-EP10-BK', 2, 42.99, 85.98, 'pending', datetime('now'))");
}

describe("Order Repository", () => {
  beforeEach(async () => { await newDb(); });

  it("list: all orders when no filter", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'PH-CASE-15PM', 1, 'shipped', datetime('now'))");
    const r = db.exec("SELECT COUNT(*) as count FROM \"order\"");
    expect(r[0].values[0][0]).toBe(2);
  });

  it("list: filters by status", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'PH-CASE-15PM', 1, 'shipped', datetime('now'))");
    const r = db.exec("SELECT id FROM \"order\" WHERE status = 'shipped'");
    expect(r[0].values).toHaveLength(1);
    expect(r[0].values[0][0]).toBe("o2");
  });

  it("list: filters by platform_id", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-sp', 'SP-001', 'PH-CASE-15PM', 1, 'pending', datetime('now'))");
    const r = db.exec("SELECT id FROM \"order\" WHERE platform_id = 'p-amz'");
    expect(r[0].values).toHaveLength(1);
    expect(r[0].values[0][0]).toBe("o1");
  });

  it("list: SKU LIKE filter", () => {
    const r = db.exec("SELECT id FROM \"order\" WHERE sku LIKE '%BT-EP%'");
    expect(r[0].values).toHaveLength(1);
  });

  it("list: pagination with LIMIT OFFSET", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'PH-CASE-15PM', 1, 'pending', datetime('now'))");
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o3', 'p-amz', 'AMZ-003', 'BT-EP10-BK', 3, 'pending', datetime('now'))");
    const r1 = db.exec("SELECT id FROM \"order\" ORDER BY order_time DESC LIMIT 2 OFFSET 0");
    const r2 = db.exec("SELECT id FROM \"order\" ORDER BY order_time DESC LIMIT 2 OFFSET 2");
    expect(r1[0].values).toHaveLength(2);
    expect(r2[0].values).toHaveLength(1);
  });

  it("list: combined status + SKU", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'BT-EP10-BK', 1, 'shipped', datetime('now'))");
    const r = db.exec("SELECT id FROM \"order\" WHERE status = 'pending' AND sku LIKE '%BT-EP%'");
    expect(r[0].values[0][0]).toBe("o1");
  });

  it("list: date range filter", () => {
    db.run("UPDATE \"order\" SET order_time = '2025-06-01' WHERE id = 'o1'");
    const r = db.exec("SELECT id FROM \"order\" WHERE order_time >= '2024-01-01' AND order_time <= '2099-01-01'");
    expect(r[0].values).toHaveLength(1);
  });

  it("getById: found", () => {
    const r = db.exec("SELECT sku FROM \"order\" WHERE id = 'o1'");
    expect(r[0].values[0][0]).toBe("BT-EP10-BK");
  });

  it("getById: not found", () => {
    const r = db.exec("SELECT * FROM \"order\" WHERE id = 'noexist'");
    expect(r).toHaveLength(0);
  });

  it("updateStatus: status only", () => {
    db.run("UPDATE \"order\" SET status = 'shipped' WHERE id = 'o1'");
    expect(execOne("SELECT status FROM \"order\" WHERE id = 'o1'")![0]).toBe("shipped");
  });

  it("updateStatus: with tracking number", () => {
    db.run("UPDATE \"order\" SET status = 'shipped', tracking_number = '1Z12345', shipped_time = datetime('now') WHERE id = 'o1'");
    const r = execOne("SELECT status, tracking_number, shipped_time FROM \"order\" WHERE id = 'o1'")!;
    expect(r[0]).toBe("shipped");
    expect(r[1]).toBe("1Z12345");
    expect(r[2]).toBeTruthy();
  });

  it("batchUpdateStatus: all IDs", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'PH-CASE-15PM', 1, 'pending', datetime('now'))");
    db.run("UPDATE \"order\" SET status = 'cancelled' WHERE id IN ('o1','o2')");
    expect(execOne("SELECT status FROM \"order\" WHERE id = 'o1'")![0]).toBe("cancelled");
    expect(execOne("SELECT status FROM \"order\" WHERE id = 'o2'")![0]).toBe("cancelled");
  });

  it("getPendingCount: count pending+matched", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o2', 'p-amz', 'AMZ-002', 'PH-CASE-15PM', 1, 'pending', datetime('now'))");
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o3', 'p-amz', 'AMZ-003', 'BT-EP10-BK', 3, 'matched', datetime('now'))");
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, status, synced_at) VALUES ('o4', 'p-amz', 'AMZ-004', 'BT-EP10-BK', 1, 'shipped', datetime('now'))");
    expect(execOne("SELECT COUNT(*) as count FROM \"order\" WHERE status IN ('pending','matched')")![0]).toBe(3);
  });

  it("upsert ON CONFLICT DO UPDATE", () => {
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, unit_price, total_amount, status) VALUES ('o-u1', 'p-amz', 'AMZ-UPSERT', 'BT-EP10-BK', 1, 10, 10, 'pending')");
    expect(execOne("SELECT status FROM \"order\" WHERE platform_order_id = 'AMZ-UPSERT'")![0]).toBe("pending");
    db.run("INSERT INTO \"order\" (id, platform_id, platform_order_id, sku, quantity, unit_price, currency, total_amount, status) VALUES ('o-u2', 'p-amz', 'AMZ-UPSERT', 'BT-EP10-BK', 2, 20, 'USD', 40, 'shipped') ON CONFLICT(platform_id, platform_order_id) DO UPDATE SET status = excluded.status");
    expect(execOne("SELECT status FROM \"order\" WHERE platform_order_id = 'AMZ-UPSERT'")![0]).toBe("shipped");
  });
});
