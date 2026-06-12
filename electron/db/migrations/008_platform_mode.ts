const migration = `
-- Add platform business mode
ALTER TABLE platform ADD COLUMN mode TEXT DEFAULT 'fbm' CHECK(mode IN ('fba','fbm','fulfillment','cross_border'));

-- Update known platforms to correct modes
UPDATE platform SET mode = 'fba' WHERE code = 'amazon';
-- Shopee/TikTok default to 'cross_border' (platform logistics SLS/TikTok logistics)

-- Add original currency tracking to orders
ALTER TABLE "order" ADD COLUMN amount_original REAL;
ALTER TABLE "order" ADD COLUMN currency_original TEXT;

-- Add version column for optimistic concurrency control
ALTER TABLE "order" ADD COLUMN version INTEGER DEFAULT 1;

-- Order line items (a single order can have multiple products)
CREATE TABLE IF NOT EXISTS order_item (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES "order"(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  platform_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  item_index INTEGER DEFAULT 0
);

-- Migrate existing single-SKU orders to order_item
INSERT OR IGNORE INTO order_item (id, order_id, product_id, sku, quantity, unit_price, total_price, item_index)
  SELECT
    hex(randomblob(16)) as id,
    o.id as order_id,
    o.product_id,
    o.sku,
    o.quantity,
    o.unit_price,
    o.total_amount,
    0
  FROM "order" o
  WHERE NOT EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id);
`;

export default migration;
