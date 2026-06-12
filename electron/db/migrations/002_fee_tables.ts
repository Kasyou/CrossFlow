const migration = `
CREATE TABLE IF NOT EXISTS fee_config (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  fee_type TEXT NOT NULL CHECK(fee_type IN ('commission','payment','logistics','ads','other')),
  rate REAL DEFAULT 0,
  fixed_amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS order_cost (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES "order"(id),
  cost_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  note TEXT
);

-- Seed default fee configs for common platforms
INSERT OR IGNORE INTO fee_config (id, platform_id, fee_type, rate, fixed_amount)
  SELECT 'fc-amz-commission', id, 'commission', 0.15, 0 FROM platform WHERE code = 'amazon'
  UNION ALL
  SELECT 'fc-amz-payment', id, 'payment', 0.029, 0.30 FROM platform WHERE code = 'amazon'
  UNION ALL
  SELECT 'fc-shopee-commission', id, 'commission', 0.06, 0 FROM platform WHERE code = 'shopee'
  UNION ALL
  SELECT 'fc-shopee-payment', id, 'payment', 0.02, 0 FROM platform WHERE code = 'shopee';
`;

export default migration;
