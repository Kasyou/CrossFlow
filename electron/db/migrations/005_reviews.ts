const migration = `
CREATE TABLE IF NOT EXISTS product_review (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  platform_review_id TEXT,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  reviewer_name TEXT,
  review_date TEXT,
  is_negative INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_alert (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES product_review(id) ON DELETE CASCADE,
  alert_type TEXT CHECK(alert_type IN ('negative','spike','trend')),
  message TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export default migration;
