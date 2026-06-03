import { getDbSync } from '../connection';
import { v4 as uuid } from 'uuid';

export interface SyncLogRow {
  id: string;
  platform_id: string;
  sync_type: 'order' | 'inventory' | 'product';
  status: 'success' | 'partial' | 'failed';
  message: string | null;
  records_count: number;
  started_at: string;
  finished_at: string;
}

export const SyncLogRepo = {
  create(platformId: string, syncType: string): string {
    const id = uuid();
    getDbSync().prepare(
      'INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(id, platformId, syncType, 'success');
    return id;
  },

  finish(id: string, status: string, message: string | null, recordsCount: number): void {
    getDbSync().prepare(
      'UPDATE sync_log SET status = ?, message = ?, records_count = ?, finished_at = datetime(\'now\') WHERE id = ?'
    ).run(status, message, recordsCount, id);
  },

  getRecent(limit = 20): SyncLogRow[] {
    return getDbSync().prepare('SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?').all(limit) as SyncLogRow[];
  },
};
