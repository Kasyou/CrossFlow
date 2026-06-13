import cron from 'node-cron';
import { PlatformRepo } from '../db/repositories/platform-repo';
import { SyncLogRepo } from '../db/repositories/sync-log-repo';
import { OrderRepo } from '../db/repositories/order-repo';
import { syncAmazonOrders } from './amazon';
import { syncShopeeOrders } from './shopee';
import { syncTikTokOrders } from './tiktok';
import { syncLazadaOrders } from './lazada';
import { resolveSku, ensureProductPlatformLink } from '../db/matching';
import { getDbSync } from '../db/connection';
export { getDashboardMetrics } from '../db/dashboard-metrics';

const jobs = new Map<string, cron.ScheduledTask>();
const syncing = new Set<string>(); // concurrency guard

export function startAllSyncJobs(): void {
  const platforms = PlatformRepo.getAll();
  for (const p of platforms) {
    if (p.sync_enabled) schedulePlatform(p.code);
  }
  // Daily exchange rate sync
  const exchangeJob = cron.schedule('0 6 * * *', async () => {
    try {
      const { syncExchangeRates } = require('./exchange-rate');
      await syncExchangeRates();
    } catch { /* silent */ }
  });
  jobs.set('__exchange_rates__', exchangeJob);
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
  if (syncing.has(code)) return { status: 'partial', records: 0, message: 'Sync already in progress' };
  syncing.add(code);
  const platform = PlatformRepo.getByCode(code);
  if (!platform) { syncing.delete(code); return { status: 'failed', records: 0, message: 'Platform not found' }; }

  const logId = SyncLogRepo.create(platform.id, 'order');

  try {
    let result: { orders: any[]; message?: string };
    switch (code) {
      case 'amazon': result = await withRetry(() => syncAmazonOrders(platform)); break;
      case 'shopee': result = await withRetry(() => syncShopeeOrders(platform)); break;
      case 'tiktok': result = await withRetry(() => syncTikTokOrders(platform)); break;
      case 'lazada': result = await withRetry(() => syncLazadaOrders(platform)); break;
      default: result = { orders: [], message: 'No API sync for this platform' };
    }

    let synced = 0;
    let matchedCount = 0;
    for (const order of result.orders) {
      const rawPlatformSku = order.sku;
      const resolved = resolveSku(code, rawPlatformSku);
      if (resolved) {
        order.product_id = resolved.product_id;
        order.sku = resolved.sku;
        ensureProductPlatformLink(code, resolved.product_id, rawPlatformSku);
        matchedCount++;
      }
      const saved = OrderRepo.upsert({ ...order, platform_id: platform.id });

      // Write order_item rows: use _items array if available, else single-item fallback
      const db = getDbSync();
      const { v4: uuid } = require('uuid');
      const itemList = (order._items && order._items.length > 0) ? order._items : [{ sku: order.sku, quantity: order.quantity, unit_price: order.unit_price, currency: order.currency }];
      let idx = 0;
      for (const item of itemList) {
        const itemResolved = resolveSku(code, item.sku);
        const itemProductId = itemResolved ? itemResolved.product_id : saved.product_id;
        const itemSku = itemResolved ? itemResolved.sku : item.sku;
        const existingItem = db.prepare('SELECT id FROM order_item WHERE order_id = ? AND sku = ? AND item_index = ?').get(saved.id, itemSku, idx) as any;
        if (!existingItem) {
          db.prepare(
            'INSERT INTO order_item (id, order_id, product_id, sku, platform_sku, quantity, unit_price, total_price, item_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(uuid(), saved.id, itemProductId, itemSku, item.sku, item.quantity, item.unit_price, item.quantity * item.unit_price, idx);
        }
        idx++;
      }
      synced++;
    }

    // Preserve original platform_sku in the message for unmatched items
    const detail = matchedCount < synced
      ? ` (${matchedCount}/${synced} matched to local products)`
      : '';

    const status = synced > 0 ? 'success' : 'partial';
    const msg = (result.message || 'OK') + detail;
    SyncLogRepo.finish(logId, status, msg, synced);
    return { status, records: synced, message: msg };
  } catch (err: any) {
    SyncLogRepo.finish(logId, 'failed', err.message, 0);
    return { status: 'failed', records: 0, message: err.message };
  } finally {
    syncing.delete(code);
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

function _old_getDashboardMetrics() {
  const db = getDbSync();
  const today = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount
     FROM "order" WHERE date(order_time) = date('now')`
  ).get() as { revenue: number; orderCount: number };
  const yesterday = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount
     FROM "order" WHERE date(order_time) = date('now', '-1 day')`
  ).get() as { revenue: number; orderCount: number };

  // Count active SKUs: has inventory or active platform listing
  const skuCount = (db.prepare(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM product p
     WHERE p.id IN (SELECT product_id FROM inventory WHERE available > 0 OR reserved > 0 OR in_transit > 0)
        OR p.id IN (SELECT product_id FROM product_platform WHERE status = 'active')`
  ).get() as { count: number }).count;

  const totalAvailable = (db.prepare(
    'SELECT COALESCE(SUM(available), 0) as total FROM inventory'
  ).get() as { total: number }).total;

  const dailyAvgSales = (db.prepare(
    `SELECT COALESCE(CAST(COUNT(*) AS REAL) / 30, 0) as avg FROM "order" WHERE order_time >= date('now', '-30 days')`
  ).get() as { avg: number }).avg;

  const turnoverDays = dailyAvgSales > 0 ? Math.round(totalAvailable / dailyAvgSales) : 0;

  return {
    todayRevenue: today.revenue,
    todayOrderCount: today.orderCount,
    yesterdayRevenue: yesterday.revenue,
    yesterdayOrderCount: yesterday.orderCount,
    avgInventoryTurnoverDays: turnoverDays,
    totalSkuCount: skuCount,
  };
}
