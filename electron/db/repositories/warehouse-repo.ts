import { getDbSync } from '../connection';
import { buildSetClauses, WAREHOUSE_COLUMNS } from '../safe-columns';
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

  update(id: string, fields: Record<string, unknown>): void {
    const { clauses, values } = buildSetClauses(fields, WAREHOUSE_COLUMNS);
    if (clauses.length === 0) return;
    values.push(id);
    getDbSync().prepare(`UPDATE warehouse SET ${clauses.join(', ')} WHERE id = ?`).run(...values);
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
