import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface WarehouseRow {
  id: string;
  name: string;
  type: 'domestic' | 'fba' | 'overseas';
  country: string | null;
  is_default: number;
}

export const WarehouseRepo = {
  getAll(): WarehouseRow[] {
    return getDbSync().prepare('SELECT * FROM warehouse ORDER BY is_default DESC').all() as WarehouseRow[];
  },

  getById(id: string): WarehouseRow | undefined {
    return getDbSync().prepare('SELECT * FROM warehouse WHERE id = ?').get(id) as WarehouseRow | undefined;
  },

  create(name: string, type: string, country?: string): WarehouseRow {
    const id = uuid();
    getDbSync().prepare('INSERT INTO warehouse (id, name, type, country) VALUES (?, ?, ?, ?)').run(id, name, type, country || null);
    return this.getById(id)!;
  },

  update(id: string, fields: Partial<Pick<WarehouseRow, 'name' | 'country'>>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.country !== undefined) { sets.push('country = ?'); vals.push(fields.country); }
    if (sets.length === 0) return;
    vals.push(id);
    getDbSync().prepare(`UPDATE warehouse SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },

  setDefault(id: string): void {
    const db = getDbSync();
    db.prepare('UPDATE warehouse SET is_default = 0').run();
    db.prepare('UPDATE warehouse SET is_default = 1 WHERE id = ?').run(id);
  },

  delete(id: string): void {
    getDbSync().prepare('DELETE FROM warehouse WHERE id = ?').run(id);
  },
};
