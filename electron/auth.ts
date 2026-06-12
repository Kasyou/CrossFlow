// Local authentication for CrossFlow desktop app
// Uses pbkdf2 for password hashing, role-based access control

import { pbkdf2Sync, randomBytes } from 'crypto';
import { getDbSync } from './db/connection';
import { v4 as uuid } from 'uuid';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'operator' | 'cs' | 'warehouse';
  active: number;
  last_login: string | null;
  created_at: string;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  operator: ['orders:*', 'inventory:*', 'products:*', 'dashboard:*', 'tracking:*', 'platform:*', 'supplier:*', 'po:*', 'review:*', 'finance:*'],
  cs: ['orders:view', 'products:view', 'review:*', 'ai:customerReply'],
  warehouse: ['inventory:*', 'po:*', 'orders:view', 'products:view', 'tracking:*'],
};

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex');
  return hash === verify;
}

export function createUser(username: string, password: string, displayName: string, role: string): UserRow {
  const db = getDbSync();
  const id = uuid();
  const hash = hashPassword(password);
  db.prepare('INSERT INTO user (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, username, hash, displayName, role);
  return getUserById(id)!;
}

export function authenticate(username: string, password: string): { user: UserRow; token: string } | null {
  const db = getDbSync();
  const row = db.prepare('SELECT * FROM user WHERE username = ? AND active = 1').get(username) as any;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;

  db.prepare('UPDATE user SET last_login = datetime(\'now\') WHERE id = ?').run(row.id);

  const user: UserRow = {
    id: row.id, username: row.username, display_name: row.display_name,
    role: row.role, active: row.active, last_login: row.last_login, created_at: row.created_at,
  };
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  return { user, token };
}

export function getUserById(id: string): UserRow | undefined {
  const row = getDbSync().prepare('SELECT * FROM user WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return { id: row.id, username: row.username, display_name: row.display_name, role: row.role, active: row.active, last_login: row.last_login, created_at: row.created_at };
}

export function getAllUsers(): UserRow[] {
  return getDbSync().prepare('SELECT * FROM user ORDER BY created_at').all() as any[];
}

export function checkPermission(role: string, action: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  const [resource] = action.split(':');
  return perms.some(p => {
    const [pResource, pAction] = p.split(':');
    if (pResource !== resource) return false;
    return pAction === '*' || pAction === action.split(':')[1];
  });
}

export function auditLog(userId: string, action: string, entityType?: string, entityId?: string, details?: string): void {
  getDbSync().prepare(
    'INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuid(), userId, action, entityType || null, entityId || null, details || null);
}
