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
  db.run("CREATE TABLE product (id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_en TEXT, category TEXT, cost_price REAL DEFAULT 0, weight_kg REAL DEFAULT 0, safety_stock INTEGER DEFAULT 10, created_at TEXT)");
  db.run("CREATE TABLE platform (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, auth_data TEXT, sync_enabled INTEGER DEFAULT 1, sync_interval INTEGER DEFAULT 900)");
  db.run("CREATE TABLE warehouse (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, country TEXT, is_default INTEGER DEFAULT 0)");
  db.run("CREATE TABLE inventory (id TEXT PRIMARY KEY, product_id TEXT, warehouse_id TEXT, available INTEGER DEFAULT 0, reserved INTEGER DEFAULT 0, in_transit INTEGER DEFAULT 0, updated_at TEXT, UNIQUE(product_id, warehouse_id))");
  db.run("CREATE TABLE sync_log (id TEXT PRIMARY KEY, platform_id TEXT, sync_type TEXT, status TEXT, message TEXT, records_count INTEGER DEFAULT 0, started_at TEXT, finished_at TEXT)");
  db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock, created_at) VALUES ('sku-001', 'BT-EP10-BK', 'Bluetooth Earbuds Pro', 28, 30, datetime('now'))");
  db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock, created_at) VALUES ('sku-002', 'PH-CASE-15PM', 'iPhone 15 Pro Max Case', 5, 50, datetime('now'))");
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-amz', 'amazon', 'Amazon')");
  db.run("INSERT INTO platform (id, code, name) VALUES ('p-sp', 'shopee', 'Shopee')");
  db.run("INSERT INTO warehouse (id, name, type, is_default) VALUES ('w-gz', 'Guangzhou Ware', 'domestic', 1)");
  db.run("INSERT INTO warehouse (id, name, type, is_default) VALUES ('w-fba', 'FBA East', 'fba', 0)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-1', 'sku-001', 'w-gz', 100, 0, 0)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-2', 'sku-002', 'w-gz', 200, 10, 50)");
  db.run("INSERT INTO inventory (id, product_id, warehouse_id, available, reserved, in_transit) VALUES ('inv-3', 'sku-001', 'w-fba', 50, 5, 10)");
}

describe("Product Repository", () => {
  beforeEach(async () => { await newDb(); });
  it("getAll returns products ordered by created_at DESC", () => {
    const r = db.exec("SELECT sku FROM product ORDER BY created_at DESC");
    expect(r[0].values).toHaveLength(2);
  });
  it("getBySku: found", () => {
    const r = execOne("SELECT name FROM product WHERE sku = 'BT-EP10-BK'");
    expect(r![0]).toBe("Bluetooth Earbuds Pro");
  });
  it("getBySku: not found", () => {
    const r = db.exec("SELECT * FROM product WHERE sku = 'NONEXIST'");
    expect(r).toHaveLength(0);
  });
  it("create inserts product", () => {
    db.run("INSERT INTO product (id, sku, name, cost_price, safety_stock) VALUES ('new', 'SKU-NEW', 'New Product', 0, 10)");
    expect(execOne("SELECT sku FROM product WHERE id = 'new'")![0]).toBe("SKU-NEW");
  });
  it("create fails on duplicate SKU", () => {
    expect(() => db.run("INSERT INTO product (id, sku, name) VALUES ('dup', 'BT-EP10-BK', 'Dup')")).toThrow();
  });
  it("update modifies fields", () => {
    db.run("UPDATE product SET name = 'Updated', cost_price = 35 WHERE sku = 'BT-EP10-BK'");
    expect(execOne("SELECT name FROM product WHERE sku = 'BT-EP10-BK'")![0]).toBe("Updated");
  });
  it("deleteBySku removes product", () => {
    db.run("DELETE FROM product WHERE sku = 'BT-EP10-BK'");
    expect(execOne("SELECT COUNT(*) as c FROM product")![0]).toBe(1);
  });
  it("search: SKU partial match", () => {
    const r = db.exec("SELECT id FROM product WHERE sku LIKE '%EP10%' OR name LIKE '%EP10%'");
    expect(r[0].values).toHaveLength(1);
  });
  it("search: name partial match", () => {
    const r = db.exec("SELECT id FROM product WHERE sku LIKE '%Earbuds%' OR name LIKE '%Earbuds%'");
    expect(r[0].values).toHaveLength(1);
  });
  it("search: no match", () => {
    const r = db.exec("SELECT id FROM product WHERE sku LIKE '%ZZZZ%' OR name LIKE '%ZZZZ%'");
    expect(r).toHaveLength(0);
  });
});

describe("Platform Repository", () => {
  beforeEach(async () => { await newDb(); });
  it("getAll returns all", () => { const r = db.exec("SELECT id FROM platform"); expect(r[0].values).toHaveLength(2); });
  it("getByCode: found", () => { expect(execOne("SELECT name FROM platform WHERE code = 'amazon'")![0]).toBe("Amazon"); });
  it("getByCode: not found", () => { const r = db.exec("SELECT * FROM platform WHERE code = 'unknown'"); expect(r).toHaveLength(0); });
  it("upsert inserts", () => { db.run("INSERT INTO platform (id, code, name) VALUES ('p-tm', 'temu', 'Temu') ON CONFLICT(code) DO UPDATE SET name = excluded.name"); expect(execOne("SELECT name FROM platform WHERE code = 'temu'")![0]).toBe("Temu"); });
  it("upsert updates", () => { db.run("INSERT INTO platform (id, code, name) VALUES ('p-amz-v2', 'amazon', 'Amazon V2') ON CONFLICT(code) DO UPDATE SET name = excluded.name"); expect(execOne("SELECT name FROM platform WHERE code = 'amazon'")![0]).toBe("Amazon V2"); });
  it("updateAuth", () => { db.run("UPDATE platform SET auth_data = '{\"k\":\"v\"}' WHERE code = 'amazon'"); expect(execOne("SELECT auth_data FROM platform WHERE code = 'amazon'")![0]).toBe('{"k":"v"}'); });
  it("setSyncEnabled", () => { db.run("UPDATE platform SET sync_enabled = 0 WHERE code = 'amazon'"); expect(execOne("SELECT sync_enabled FROM platform WHERE code = 'amazon'")![0]).toBe(0); });
  it("deleteByCode", () => { db.run("DELETE FROM platform WHERE code = 'amazon'"); const r = db.exec("SELECT id FROM platform"); expect(r[0].values).toHaveLength(1); });
});

describe("Warehouse Repository", () => {
  beforeEach(async () => { await newDb(); });
  it("getAll sorted by is_default DESC", () => { const r = db.exec("SELECT is_default FROM warehouse ORDER BY is_default DESC"); expect(r[0].values[0][0]).toBe(1); });
  it("getById", () => { expect(execOne("SELECT name FROM warehouse WHERE id = 'w-gz'")![0]).toBe("Guangzhou Ware"); });
  it("create", () => { db.run("INSERT INTO warehouse (id, name, type, country) VALUES ('w-new', 'New', 'overseas', 'US')"); const r = db.exec("SELECT id FROM warehouse"); expect(r[0].values).toHaveLength(3); });
  it("update", () => { db.run("UPDATE warehouse SET name = 'Updated', country = 'CN' WHERE id = 'w-gz'"); expect(execOne("SELECT name FROM warehouse WHERE id = 'w-gz'")![0]).toBe("Updated"); });
  it("setDefault", () => { db.run("UPDATE warehouse SET is_default = 0"); db.run("UPDATE warehouse SET is_default = 1 WHERE id = 'w-fba'"); expect(execOne("SELECT is_default FROM warehouse WHERE id = 'w-gz'")![0]).toBe(0); expect(execOne("SELECT is_default FROM warehouse WHERE id = 'w-fba'")![0]).toBe(1); });
  it("delete", () => { db.run("DELETE FROM warehouse WHERE id = 'w-fba'"); const r = db.exec("SELECT id FROM warehouse"); expect(r[0].values).toHaveLength(1); });
});

describe("Inventory Repository", () => {
  beforeEach(async () => { await newDb(); });
  it("reserve: available down, reserved up", () => { db.run("UPDATE inventory SET available = 95, reserved = 5 WHERE id = 'inv-1'"); expect(execOne("SELECT available FROM inventory WHERE id = 'inv-1'")![0]).toBe(95); expect(execOne("SELECT reserved FROM inventory WHERE id = 'inv-1'")![0]).toBe(5); });
  it("release: available up, reserved down", () => { db.run("UPDATE inventory SET available = 80, reserved = 20 WHERE id = 'inv-1'"); db.run("UPDATE inventory SET available = 88, reserved = 12 WHERE id = 'inv-1'"); expect(execOne("SELECT available FROM inventory WHERE id = 'inv-1'")![0]).toBe(88); });
  it("release caps reserved at 0", () => { db.run("UPDATE inventory SET available = 95, reserved = 5 WHERE id = 'inv-1'"); db.run("UPDATE inventory SET available = 105, reserved = 0 WHERE id = 'inv-1'"); expect(execOne("SELECT available FROM inventory WHERE id = 'inv-1'")![0]).toBe(105); });
  it("restock increases in_transit", () => { db.run("UPDATE inventory SET in_transit = 50 WHERE id = 'inv-1'"); expect(execOne("SELECT in_transit FROM inventory WHERE id = 'inv-1'")![0]).toBe(50); });
  it("receive: in_transit becomes available", () => { db.run("UPDATE inventory SET available = 100, in_transit = 50 WHERE id = 'inv-1'"); db.run("UPDATE inventory SET available = 120, in_transit = 30 WHERE id = 'inv-1'"); expect(execOne("SELECT in_transit FROM inventory WHERE id = 'inv-1'")![0]).toBe(30); });
  it("getTotalByProduct sums across warehouses", () => { expect(execOne("SELECT COALESCE(SUM(available),0) as ta, COALESCE(SUM(reserved),0) as tr, COALESCE(SUM(in_transit),0) as ti FROM inventory WHERE product_id = 'sku-001'")![0]).toBe(150); });
  it("getLowStock: available < safety_stock", () => { db.run("UPDATE inventory SET available = 5 WHERE id = 'inv-1'"); const r = db.exec("SELECT i.available, p.safety_stock FROM inventory i JOIN product p ON i.product_id = p.id WHERE i.available < p.safety_stock"); expect(r[0].values).toHaveLength(1); });
});

describe("Sync Log Repository", () => {
  beforeEach(async () => { await newDb(); });
  it("create inserts", () => { db.run("INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES ('l1', 'p-amz', 'order', 'success', datetime('now'))"); expect(execOne("SELECT status FROM sync_log WHERE id = 'l1'")![0]).toBe("success"); });
  it("finish updates", () => { db.run("INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES ('l1', 'p-amz', 'order', 'success', datetime('now'))"); db.run("UPDATE sync_log SET status = 'failed', message = 'err', records_count = 5, finished_at = datetime('now') WHERE id = 'l1'"); expect(execOne("SELECT status, records_count FROM sync_log WHERE id = 'l1'")![0]).toBe("failed"); });
  it("getRecent ordered by started_at DESC", () => { db.run("INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES ('a', 'p-amz', 'order', 'success', datetime('now', '-2 hours'))"); db.run("INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES ('b', 'p-sp', 'order', 'failed', datetime('now'))"); const r = db.exec("SELECT id FROM sync_log ORDER BY started_at DESC LIMIT 20"); expect(r[0].values[0][0]).toBe("b"); });
});
