import { getDbSync } from '../connection';

export interface PlatformRow {
  id: string;
  code: string;
  name: string;
  auth_data: string | null;
  sync_enabled: number;
  sync_interval: number;
}

export const PlatformRepo = {
  getAll(): PlatformRow[] {
    return getDbSync().prepare('SELECT * FROM platform').all() as PlatformRow[];
  },

  getByCode(code: string): PlatformRow | undefined {
    return getDbSync().prepare('SELECT * FROM platform WHERE code = ?').get(code) as PlatformRow | undefined;
  },

  upsert(id: string, code: string, name: string): void {
    getDbSync().prepare(
      'INSERT INTO platform (id, code, name) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name'
    ).run(id, code, name);
  },

  updateAuth(code: string, authData: string): void {
    getDbSync().prepare('UPDATE platform SET auth_data = ? WHERE code = ?').run(authData, code);
  },

  setSyncEnabled(code: string, enabled: boolean): void {
    getDbSync().prepare('UPDATE platform SET sync_enabled = ? WHERE code = ?').run(enabled ? 1 : 0, code);
  },

  setSyncInterval(code: string, intervalSeconds: number): void {
    getDbSync().prepare('UPDATE platform SET sync_interval = ? WHERE code = ?').run(intervalSeconds, code);
  },

  deleteByCode(code: string): void {
    getDbSync().prepare('DELETE FROM platform WHERE code = ?').run(code);
  },
};
