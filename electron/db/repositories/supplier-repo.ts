import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface SupplierRow {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  moq: number;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

export const SupplierRepo = {
  getAll(): SupplierRow[] {
    return getDbSync().prepare('SELECT * FROM supplier ORDER BY name').all() as SupplierRow[];
  },

  getById(id: string): SupplierRow | undefined {
    return getDbSync().prepare('SELECT * FROM supplier WHERE id = ?').get(id) as SupplierRow | undefined;
  },

  create(data: { name: string; contact?: string; email?: string; phone?: string; lead_time_days?: number; moq?: number; payment_terms?: string; notes?: string }): SupplierRow {
    const id = uuid();
    getDbSync().prepare(
      `INSERT INTO supplier (id, name, contact, email, phone, lead_time_days, moq, payment_terms, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.contact || null, data.email || null, data.phone || null, data.lead_time_days ?? 7, data.moq ?? 10, data.payment_terms || null, data.notes || null);
    return this.getById(id)!;
  },

  update(id: string, fields: Partial<Omit<SupplierRow, 'id' | 'created_at'>>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${key} = ?`); vals.push(val); }
    }
    if (sets.length === 0) return;
    vals.push(id);
    getDbSync().prepare(`UPDATE supplier SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },

  delete(id: string): void {
    getDbSync().prepare('DELETE FROM supplier WHERE id = ?').run(id);
  },
};
