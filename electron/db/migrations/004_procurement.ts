const migration = `
CREATE TABLE IF NOT EXISTS supplier (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  lead_time_days INTEGER DEFAULT 7,
  moq INTEGER DEFAULT 10,
  payment_terms TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES supplier(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','shipped','received','cancelled')),
  total_amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  expected_arrival TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_item (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT REFERENCES purchase_order(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL
);
`;

export default migration;
