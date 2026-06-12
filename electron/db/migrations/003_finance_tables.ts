const migration = `
CREATE TABLE IF NOT EXISTS currency (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  rate_to_usd REAL NOT NULL DEFAULT 1.0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS exchange_rate_log (
  id TEXT PRIMARY KEY,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  rate REAL NOT NULL,
  source TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_fee (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  order_id TEXT REFERENCES "order"(id),
  fee_type TEXT NOT NULL CHECK(fee_type IN ('commission','shipping','ads','subscription','other')),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed common currencies
INSERT OR IGNORE INTO currency (code, name, symbol, rate_to_usd) VALUES
  ('USD', 'US Dollar', '$', 1.0),
  ('CNY', 'Chinese Yuan', '¥', 0.14),
  ('EUR', 'Euro', '€', 1.08),
  ('GBP', 'British Pound', '£', 1.27),
  ('JPY', 'Japanese Yen', '¥', 0.0067),
  ('CAD', 'Canadian Dollar', 'C$', 0.73),
  ('AUD', 'Australian Dollar', 'A$', 0.66),
  ('SGD', 'Singapore Dollar', 'S$', 0.74),
  ('TWD', 'New Taiwan Dollar', 'NT$', 0.031),
  ('IDR', 'Indonesian Rupiah', 'Rp', 0.000064),
  ('THB', 'Thai Baht', '฿', 0.028),
  ('VND', 'Vietnamese Dong', '₫', 0.000041);
`;

export default migration;
