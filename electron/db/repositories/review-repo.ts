import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface ReviewRow {
  id: string;
  platform_id: string;
  product_id: string | null;
  sku: string;
  platform_review_id: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  reviewer_name: string | null;
  review_date: string | null;
  is_negative: number;
  replied: number;
  created_at: string;
}

export const ReviewRepo = {
  getAll(filter?: { rating?: number; isNegative?: boolean }): (ReviewRow & { product_name: string; platform_name: string })[] {
    let sql = `SELECT r.*, p.name as product_name, pl.name as platform_name
               FROM product_review r
               LEFT JOIN product p ON r.sku = p.sku
               LEFT JOIN platform pl ON r.platform_id = pl.id
               WHERE 1=1`;
    const params: unknown[] = [];
    if (filter?.rating !== undefined) { sql += ' AND r.rating = ?'; params.push(filter.rating); }
    if (filter?.isNegative) { sql += ' AND r.is_negative = 1'; }
    sql += ' ORDER BY r.review_date DESC LIMIT 100';
    return getDbSync().prepare(sql).all(...params) as any[];
  },

  getNegativeAlerts(): any[] {
    return getDbSync().prepare(
      `SELECT ra.*, r.rating, r.content, r.sku, p.name as product_name
       FROM review_alert ra
       JOIN product_review r ON ra.review_id = r.id
       LEFT JOIN product p ON r.sku = p.sku
       WHERE ra.acknowledged = 0
       ORDER BY ra.created_at DESC LIMIT 20`
    ).all();
  },

  upsert(data: { platform_id: string; sku: string; platform_review_id?: string; rating: number; title?: string; content?: string; reviewer_name?: string; review_date?: string }): ReviewRow {
    const db = getDbSync();
    const id = uuid();
    const isNegative = data.rating <= 2 ? 1 : 0;
    db.prepare(
      `INSERT INTO product_review (id, platform_id, sku, platform_review_id, rating, title, content, reviewer_name, review_date, is_negative)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.platform_id, data.sku, data.platform_review_id || null, data.rating, data.title || null, data.content || null, data.reviewer_name || null, data.review_date || null, isNegative);

    // Auto-create alert for negative reviews
    if (isNegative) {
      db.prepare(
        'INSERT INTO review_alert (id, review_id, alert_type, message) VALUES (?, ?, ?, ?)'
      ).run(uuid(), id, 'negative', `差评预警：SKU ${data.sku} 获得 ${data.rating} 星评价`);
    }

    return this.getById(id)!;
  },

  getById(id: string): ReviewRow | undefined {
    return getDbSync().prepare('SELECT * FROM product_review WHERE id = ?').get(id) as ReviewRow | undefined;
  },

  acknowledgeAlert(alertId: string): void {
    getDbSync().prepare('UPDATE review_alert SET acknowledged = 1 WHERE id = ?').run(alertId);
  },
};
