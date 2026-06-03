import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface InventoryRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  available: number;
  reserved: number;
  in_transit: number;
  updated_at: string;
}

export interface InventoryLogRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  change_type: 'order_reserve' | 'order_release' | 'restock' | 'adjust' | 'return';
  quantity: number;
  available_after: number;
  reserved_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export const InventoryRepo = {
  getByProductWarehouse(productId: string, warehouseId: string): InventoryRow | undefined {
    return getDbSync().prepare('SELECT * FROM inventory WHERE product_id = ? AND warehouse_id = ?').get(productId, warehouseId) as InventoryRow | undefined;
  },

  getAllWithDetails(): (InventoryRow & { sku: string; product_name: string; warehouse_name: string; warehouse_type: string })[] {
    return getDbSync().prepare(
      `SELECT i.*, p.sku, p.name as product_name, p.safety_stock, w.name as warehouse_name, w.type as warehouse_type
       FROM inventory i JOIN product p ON i.product_id = p.id JOIN warehouse w ON i.warehouse_id = w.id
       ORDER BY (i.available + i.reserved + i.in_transit) ASC`
    ).all() as any;
  },

  getLowStock(): (InventoryRow & { sku: string; product_name: string; safety_stock: number; warehouse_name: string })[] {
    return getDbSync().prepare(
      `SELECT i.*, p.sku, p.name as product_name, p.safety_stock, w.name as warehouse_name
       FROM inventory i JOIN product p ON i.product_id = p.id JOIN warehouse w ON i.warehouse_id = w.id
       WHERE i.available < p.safety_stock ORDER BY (i.available - p.safety_stock) ASC LIMIT 10`
    ).all() as any;
  },

  getTotalByProduct(productId: string): { totalAvailable: number; totalReserved: number; totalInTransit: number } {
    return getDbSync().prepare(
      'SELECT COALESCE(SUM(available),0) as totalAvailable, COALESCE(SUM(reserved),0) as totalReserved, COALESCE(SUM(in_transit),0) as totalInTransit FROM inventory WHERE product_id = ?'
    ).get(productId) as any;
  },

  ensure(productId: string, warehouseId: string): InventoryRow {
    const existing = this.getByProductWarehouse(productId, warehouseId);
    if (existing) return existing;
    const id = uuid();
    getDbSync().prepare('INSERT INTO inventory (id, product_id, warehouse_id) VALUES (?, ?, ?)').run(id, productId, warehouseId);
    return this.getByProductWarehouse(productId, warehouseId)!;
  },

  reserve(productId: string, warehouseId: string, quantity: number, orderId: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDbSync();
    const tx = db.transaction(() => {
      const newAvailable = inv.available - quantity;
      const newReserved = inv.reserved + quantity;
      db.prepare('UPDATE inventory SET available = ?, reserved = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newReserved, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'order_reserve', -quantity, newAvailable, newReserved, orderId);
    });
    tx();
  },

  release(productId: string, warehouseId: string, quantity: number, orderId: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDbSync();
    const tx = db.transaction(() => {
      const newAvailable = inv.available + quantity;
      const newReserved = Math.max(0, inv.reserved - quantity);
      db.prepare('UPDATE inventory SET available = ?, reserved = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newReserved, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'order_release', quantity, newAvailable, newReserved, orderId);
    });
    tx();
  },

  restock(productId: string, warehouseId: string, quantity: number, note?: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDbSync();
    const tx = db.transaction(() => {
      const newInTransit = inv.in_transit + quantity;
      db.prepare('UPDATE inventory SET in_transit = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newInTransit, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'restock', quantity, inv.available, inv.reserved, note || null);
    });
    tx();
  },

  receiveRestock(productId: string, warehouseId: string, quantity: number): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDbSync();
    const tx = db.transaction(() => {
      const newAvailable = inv.available + quantity;
      const newInTransit = Math.max(0, inv.in_transit - quantity);
      db.prepare('UPDATE inventory SET available = ?, in_transit = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newInTransit, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'restock', quantity, newAvailable, inv.reserved);
    });
    tx();
  },

  getLogs(productId: string, limit = 50): InventoryLogRow[] {
    return getDbSync().prepare('SELECT * FROM inventory_log WHERE product_id = ? ORDER BY created_at DESC LIMIT ?').all(productId, limit) as InventoryLogRow[];
  },
};
