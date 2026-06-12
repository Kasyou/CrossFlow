import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface PurchaseOrderRow {
  id: string;
  supplier_id: string;
  status: string;
  total_amount: number;
  currency: string;
  expected_arrival: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export const PurchaseOrderRepo = {
  getAll(): (PurchaseOrderRow & { supplier_name: string; item_count: number })[] {
    return getDbSync().prepare(
      `SELECT po.*, s.name as supplier_name,
              (SELECT COUNT(*) FROM purchase_order_item WHERE purchase_order_id = po.id) as item_count
       FROM purchase_order po
       LEFT JOIN supplier s ON po.supplier_id = s.id
       ORDER BY po.created_at DESC`
    ).all() as any[];
  },

  getById(id: string): (PurchaseOrderRow & { supplier_name: string }) | undefined {
    return getDbSync().prepare(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_order po LEFT JOIN supplier s ON po.supplier_id = s.id
       WHERE po.id = ?`
    ).get(id) as any;
  },

  getItems(orderId: string): PurchaseOrderItemRow[] {
    return getDbSync().prepare('SELECT * FROM purchase_order_item WHERE purchase_order_id = ?').all(orderId) as PurchaseOrderItemRow[];
  },

  create(supplierId: string, items: { product_id?: string; sku: string; quantity: number; unit_cost: number }[]): PurchaseOrderRow {
    const db = getDbSync();
    const id = uuid();
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

    db.prepare(
      'INSERT INTO purchase_order (id, supplier_id, total_amount, status) VALUES (?, ?, ?, ?)'
    ).run(id, supplierId, totalAmount, 'draft');

    for (const item of items) {
      db.prepare(
        'INSERT INTO purchase_order_item (id, purchase_order_id, product_id, sku, quantity, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), id, item.product_id || null, item.sku, item.quantity, item.unit_cost, item.quantity * item.unit_cost);
    }

    return this.getById(id)!;
  },

  updateStatus(id: string, status: string): void {
    const db = getDbSync();
    db.prepare('UPDATE purchase_order SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);

    // When purchase order is received, add stock to inventory
    if (status === 'received') {
      const items = this.getItems(id);
      for (const item of items) {
        const product = db.prepare('SELECT id FROM product WHERE sku = ?').get(item.sku) as any;
        if (!product) continue;
        const defaultWh = db.prepare('SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1').get() as any;
        if (!defaultWh) continue;
        // Add to in_transit → will be received later, or directly to available
        db.prepare(
          `INSERT INTO inventory (id, product_id, warehouse_id, available, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(product_id, warehouse_id) DO UPDATE SET available = available + ?, updated_at = datetime('now')`
        ).run(uuid(), product.id, defaultWh.id, item.quantity, item.quantity);
      }
    }
  },

  delete(id: string): void {
    getDbSync().prepare('DELETE FROM purchase_order WHERE id = ?').run(id);
  },
};
