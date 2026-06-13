import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface OrderRow {
  id: string;
  platform_id: string;
  platform_order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  logistics_provider: string | null;
  tracking_number: string | null;
  status: 'pending' | 'matched' | 'shipped' | 'delivered' | 'refunding' | 'refunded' | 'cancelled';
  platform_status: string | null;
  order_time: string | null;
  shipped_time: string | null;
  synced_at: string;
}

export interface OrderFilter {
  status?: string;
  platform_id?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export const OrderRepo = {
  list(filter: OrderFilter = {}): { rows: (OrderRow & { platform_name: string })[]; total: number } {
    const conditions: string[] = [];
    const vals: unknown[] = [];

    if (filter.status) { conditions.push('o.status = ?'); vals.push(filter.status); }
    if (filter.platform_id) { conditions.push('o.platform_id = ?'); vals.push(filter.platform_id); }
    if (filter.sku) { conditions.push('o.sku LIKE ?'); vals.push(`%${filter.sku}%`); }
    if (filter.dateFrom) { conditions.push('o.order_time >= ?'); vals.push(filter.dateFrom); }
    if (filter.dateTo) { conditions.push('o.order_time <= ?'); vals.push(filter.dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const db = getDbSync();
    const total = (db.prepare(`SELECT COUNT(*) as count FROM "order" o ${where}`).get(...vals) as { count: number }).count;
    const rows = db.prepare(
      `SELECT o.*, p.name as platform_name FROM "order" o LEFT JOIN platform p ON o.platform_id = p.id ${where} ORDER BY o.order_time DESC LIMIT ? OFFSET ?`
    ).all(...vals, limit, offset) as (OrderRow & { platform_name: string })[];

    return { rows, total };
  },

  getById(id: string): (OrderRow & { platform_name: string }) | undefined {
    return getDbSync().prepare(
      `SELECT o.*, p.name as platform_name FROM "order" o LEFT JOIN platform p ON o.platform_id = p.id WHERE o.id = ?`
    ).get(id) as (OrderRow & { platform_name: string }) | undefined;
  },

  upsert(data: Omit<OrderRow, 'id' | 'synced_at'> & { id?: string }): OrderRow {
    const id = data.id || uuid();
    const db = getDbSync();

    // Preserve amount in original currency before sync normalizes it
    const existing = db.prepare(
      'SELECT amount_original, currency_original FROM "order" WHERE platform_id = ? AND platform_order_id = ?'
    ).get(data.platform_id, data.platform_order_id) as any;

    db.prepare(
      `INSERT INTO "order" (id, platform_id, platform_order_id, product_id, sku, quantity, unit_price, currency,
         total_amount, buyer_name, shipping_address, logistics_provider, tracking_number, status,
         platform_status, order_time, shipped_time,
         amount_original, currency_original, version, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(platform_id, platform_order_id) DO UPDATE SET
         sku = excluded.sku,
         product_id = excluded.product_id,
         quantity = excluded.quantity,
         unit_price = excluded.unit_price,
         total_amount = excluded.total_amount,
         status = excluded.status,
         platform_status = excluded.platform_status,
         tracking_number = excluded.tracking_number,
         shipped_time = excluded.shipped_time,
         version = "order".version + 1,
         synced_at = datetime('now')`
    ).run(
      id, data.platform_id, data.platform_order_id, data.product_id, data.sku,
      data.quantity, data.unit_price, data.currency, data.total_amount,
      data.buyer_name, data.shipping_address, data.logistics_provider, data.tracking_number,
      data.status, data.platform_status, data.order_time, data.shipped_time,
      existing?.amount_original ?? data.total_amount,
      existing?.currency_original ?? data.currency,
    );
    return this.getById(id)!;
  },

  updateStatus(id: string, status: string, trackingNumber?: string): void {
    if (trackingNumber) {
      getDbSync().prepare(`UPDATE "order" SET status = ?, tracking_number = ?, shipped_time = datetime('now') WHERE id = ?`).run(status, trackingNumber, id);
    } else {
      getDbSync().prepare(`UPDATE "order" SET status = ? WHERE id = ?`).run(status, id);
    }
  },

  batchUpdateStatus(ids: string[], status: string): void {
    const db = getDbSync();
    const stmt = db.prepare(`UPDATE "order" SET status = ? WHERE id = ?`);
    db.transaction(() => {
      for (const id of ids) stmt.run(status, id);
    });
  },

  getMergeableOrders(): any[] {
    const db = getDbSync();
    const groups = db.prepare(
      `SELECT sku, shipping_address, COUNT(*) as cnt, GROUP_CONCAT(id) as order_ids, GROUP_CONCAT(platform_order_id) as platform_ids
       FROM "order"
       WHERE status = 'pending' AND shipping_address IS NOT NULL AND shipping_address != ''
       GROUP BY sku, shipping_address
       HAVING cnt > 1
       ORDER BY cnt DESC
       LIMIT 10`
    ).all();
    return groups.map((g: any) => ({
      ...g,
      order_ids: g.order_ids.split(','),
      platform_ids: g.platform_ids.split(','),
    }));
  },

  getPendingCount(): number {
    return (getDbSync().prepare(`SELECT COUNT(*) as count FROM "order" WHERE status IN ('pending','matched')`).get() as { count: number }).count;
  },

  getTodayStats(): { revenue: number; orderCount: number } {
    const row = getDbSync().prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount FROM "order" WHERE date(order_time) = date('now')`
    ).get() as { revenue: number; orderCount: number };
    return row;
  },
};
