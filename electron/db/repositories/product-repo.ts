import { getDbSync } from '../connection';
import { buildSetClauses, PRODUCT_COLUMNS } from '../safe-columns';
import { v4 as uuid } from 'uuid';

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
  category: string | null;
  cost_price: number;
  weight_kg: number;
  safety_stock: number;
  created_at: string;
}

export const ProductRepo = {
  getAll(): ProductRow[] {
    return getDbSync().prepare('SELECT * FROM product ORDER BY created_at DESC').all() as ProductRow[];
  },

  getBySku(sku: string): ProductRow | undefined {
    return getDbSync().prepare('SELECT * FROM product WHERE sku = ?').get(sku) as ProductRow | undefined;
  },

  getById(id: string): ProductRow | undefined {
    return getDbSync().prepare('SELECT * FROM product WHERE id = ?').get(id) as ProductRow | undefined;
  },

  create(data: { sku: string; name: string; name_en?: string; category?: string; cost_price?: number; weight_kg?: number; safety_stock?: number }): ProductRow {
    const id = uuid();
    getDbSync().prepare(
      `INSERT INTO product (id, sku, name, name_en, category, cost_price, weight_kg, safety_stock, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, data.sku, data.name, data.name_en || null, data.category || null, data.cost_price ?? 0, data.weight_kg ?? 0, data.safety_stock ?? 10);
    return this.getById(id)!;
  },

  update(sku: string, fields: Record<string, unknown>): void {
    const { clauses, values } = buildSetClauses(fields, PRODUCT_COLUMNS);
    if (clauses.length === 0) return;
    values.push(sku);
    getDbSync().prepare(`UPDATE product SET ${clauses.join(', ')} WHERE sku = ?`).run(...values);
  },

  deleteBySku(sku: string): void {
    getDbSync().prepare('DELETE FROM product WHERE sku = ?').run(sku);
  },

  search(query: string): ProductRow[] {
    return getDbSync().prepare('SELECT * FROM product WHERE sku LIKE ? OR name LIKE ? ORDER BY created_at DESC')
      .all(`%${query}%`, `%${query}%`) as ProductRow[];
  },
};
