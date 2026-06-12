const migration = `
CREATE TABLE IF NOT EXISTS freight_shipment (
  id TEXT PRIMARY KEY,
  shipment_ref TEXT NOT NULL,
  transport_mode TEXT NOT NULL CHECK(transport_mode IN ('sea','air','rail','truck')),
  container_number TEXT,
  bl_number TEXT,
  origin TEXT,
  destination TEXT,
  departure_date TEXT,
  estimated_arrival TEXT,
  actual_arrival TEXT,
  status TEXT DEFAULT 'in_transit' CHECK(status IN ('planned','in_transit','arrived','customs','delivered')),
  carrier TEXT,
  total_cbm REAL,
  total_weight_kg REAL,
  total_cost REAL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS freight_shipment_item (
  id TEXT PRIMARY KEY,
  shipment_id TEXT REFERENCES freight_shipment(id) ON DELETE CASCADE,
  purchase_order_id TEXT REFERENCES purchase_order(id),
  sku TEXT NOT NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL,
  cartons INTEGER DEFAULT 1,
  cbm REAL DEFAULT 0,
  weight_kg REAL DEFAULT 0
);
`;

export default migration;
