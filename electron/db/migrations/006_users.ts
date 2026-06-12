const migration = `
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','operator','cs','warehouse')),
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES user(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default admin (password: admin123, change immediately)
INSERT OR IGNORE INTO user (id, username, password_hash, display_name, role)
VALUES ('u-admin', 'admin', '$2a$10$placeholder_admin_hash_change_immediately', '管理员', 'admin');
`;

export default migration;
