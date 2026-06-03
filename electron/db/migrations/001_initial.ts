const migration = `
CREATE TABLE IF NOT EXISTS platform (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  auth_data TEXT,
  sync_enabled INTEGER DEFAULT 1,
  sync_interval INTEGER DEFAULT 900
);

CREATE TABLE IF NOT EXISTS warehouse (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('domestic', 'fba', 'overseas')),
  country TEXT,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  category TEXT,
  cost_price REAL DEFAULT 0,
  weight_kg REAL DEFAULT 0,
  safety_stock INTEGER DEFAULT 10,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_platform (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  platform_id TEXT REFERENCES platform(id) ON DELETE CASCADE,
  platform_sku TEXT,
  platform_pid TEXT,
  selling_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'deleted')),
  UNIQUE(product_id, platform_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouse(id) ON DELETE CASCADE,
  available INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouse(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK(change_type IN ('order_reserve','order_release','restock','adjust','return')),
  quantity INTEGER NOT NULL,
  available_after INTEGER,
  reserved_after INTEGER,
  reference_id TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "order" (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  platform_order_id TEXT NOT NULL,
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  total_amount REAL DEFAULT 0,
  buyer_name TEXT,
  shipping_address TEXT,
  logistics_provider TEXT,
  tracking_number TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','matched','shipped','delivered','refunding','refunded','cancelled')),
  platform_status TEXT,
  order_time TEXT,
  shipped_time TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform_id, platform_order_id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  sync_type TEXT CHECK(sync_type IN ('order','inventory','product')),
  status TEXT CHECK(status IN ('success','partial','failed')),
  message TEXT,
  records_count INTEGER DEFAULT 0,
  started_at TEXT,
  finished_at TEXT
);
`;

export default migration;
