// SKU matching engine: platform_sku → product_platform → local product
// Replaces the fragile string-equality match between order.sku and product.sku

import { getDbSync } from './connection';

interface ResolvedProduct {
  product_id: string;
  sku: string;
  name: string;
  platform_sku: string;
}

export function resolveSku(platformCode: string, platformSku: string): ResolvedProduct | null {
  if (!platformSku) return null;

  const db = getDbSync();

  // Strategy 1: Exact match via product_platform table
  let row = db.prepare(
    `SELECT pp.product_id, p.sku, p.name, pp.platform_sku
     FROM product_platform pp
     JOIN product p ON pp.product_id = p.id
     JOIN platform pl ON pp.platform_id = pl.id
     WHERE pl.code = ? AND pp.platform_sku = ?`
  ).get(platformCode, platformSku) as ResolvedProduct | undefined;

  if (row) return { product_id: row.product_id, sku: row.sku, name: row.name, platform_sku: platformSku };

  // Strategy 2: Direct SKU match on product table (fallback for Excel-imported orders)
  row = db.prepare(
    `SELECT id as product_id, sku, name FROM product WHERE sku = ?`
  ).get(platformSku) as ResolvedProduct | undefined;

  if (row) return { product_id: row.product_id, sku: row.sku, name: row.name, platform_sku: platformSku };

  // Strategy 3: Fuzzy match — try stripping whitespace/special chars
  const normalized = platformSku.replace(/[\s\-_]/g, '').toUpperCase();
  const products = db.prepare('SELECT id as product_id, sku, name FROM product').all() as ResolvedProduct[];
  const fuzzy = products.find(p => p.sku.replace(/[\s\-_]/g, '').toUpperCase() === normalized);

  if (fuzzy) return { product_id: fuzzy.product_id, sku: fuzzy.sku, name: fuzzy.name, platform_sku: platformSku };

  return null; // No match found — unmapped SKU
}

export function ensureProductPlatformLink(
  platformCode: string, productId: string, platformSku: string, platformPid?: string,
): void {
  if (!platformSku) return;
  const db = getDbSync();

  const platform = db.prepare('SELECT id FROM platform WHERE code = ?').get(platformCode) as any;
  if (!platform) return;

  const existing = db.prepare(
    'SELECT id FROM product_platform WHERE product_id = ? AND platform_id = ?'
  ).get(productId, platform.id) as any;

  if (existing) {
    // Update if platform_sku changed
    db.prepare('UPDATE product_platform SET platform_sku = ?, platform_pid = ? WHERE id = ?')
      .run(platformSku, platformPid || null, existing.id);
  } else {
    const { v4: uuid } = require('uuid');
    db.prepare(
      `INSERT INTO product_platform (id, product_id, platform_id, platform_sku, platform_pid)
       VALUES (?, ?, ?, ?, ?)`
    ).run(uuid(), productId, platform.id, platformSku, platformPid || null);
  }
}
