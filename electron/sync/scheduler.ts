import cron from 'node-cron';
import { PlatformRepo } from '../db/repositories/platform-repo';
import { SyncLogRepo } from '../db/repositories/sync-log-repo';
import { OrderRepo } from '../db/repositories/order-repo';
import { syncAmazonOrders } from './amazon';
import { syncShopeeOrders } from './shopee';
import { syncTikTokOrders } from './tiktok';
import { getDbSync } from '../db/connection';

const jobs = new Map<string, cron.ScheduledTask>();

export function startAllSyncJobs(): void {
  const platforms = PlatformRepo.getAll();
  for (const p of platforms) {
    if (p.sync_enabled) schedulePlatform(p.code);
  }
}

export function stopAllSyncJobs(): void {
  for (const [, job] of jobs) {
    job.stop();
  }
  jobs.clear();
}

function schedulePlatform(code: string): void {
  stopPlatformJob(code);
  const platform = PlatformRepo.getByCode(code);
  if (!platform || !platform.sync_enabled) return;
  const intervalSeconds = platform.sync_interval || 900;
  const minutes = Math.max(1, Math.floor(intervalSeconds / 60));
  const cronExpr = `*/${minutes} * * * *`;

  const job = cron.schedule(cronExpr, () => {
    syncPlatform(code).catch(err => console.error(`Sync failed for ${code}:`, err));
  });
  jobs.set(code, job);
}

export function stopPlatformJob(code: string): void {
  const existing = jobs.get(code);
  if (existing) { existing.stop(); jobs.delete(code); }
}

export async function runManualSync(code: string): Promise<{ status: string; records: number; message: string }> {
  return syncPlatform(code);
}

async function syncPlatform(code: string): Promise<{ status: string; records: number; message: string }> {
  const platform = PlatformRepo.getByCode(code);
  if (!platform) return { status: 'failed', records: 0, message: 'Platform not found' };

  const logId = SyncLogRepo.create(platform.id, 'order');

  try {
    let result: { orders: any[]; message?: string };
    switch (code) {
      case 'amazon': result = await withRetry(() => syncAmazonOrders(platform)); break;
      case 'shopee': result = await withRetry(() => syncShopeeOrders(platform)); break;
      case 'tiktok': result = await withRetry(() => syncTikTokOrders(platform)); break;
      default: result = { orders: [], message: 'No API sync for this platform' };
    }

    let synced = 0;
    for (const order of result.orders) {
      OrderRepo.upsert({ ...order, platform_id: platform.id });
      synced++;
    }

    const status = synced > 0 ? 'success' : 'partial';
    SyncLogRepo.finish(logId, status, result.message || null, synced);
    return { status, records: synced, message: result.message || 'OK' };
  } catch (err: any) {
    SyncLogRepo.finish(logId, 'failed', err.message, 0);
    return { status: 'failed', records: 0, message: err.message };
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const delays = [60000, 300000, 900000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delays[attempt] || 900000));
    }
  }
  throw new Error('unreachable');
}

export function getDashboardMetrics() {
  const today = OrderRepo.getTodayStats();
  const db = getDbSync();
  const yesterday = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount FROM "order" WHERE date(synced_at) = date('now', '-1 day')`
  ).get() as { revenue: number; orderCount: number };

  const skuCount = (db.prepare('SELECT COUNT(*) as count FROM product').get() as { count: number }).count;

  return {
    todayRevenue: today.revenue,
    todayOrderCount: today.orderCount,
    yesterdayRevenue: yesterday.revenue,
    yesterdayOrderCount: yesterday.orderCount,
    avgInventoryTurnoverDays: 0,
    totalSkuCount: skuCount,
  };
}
