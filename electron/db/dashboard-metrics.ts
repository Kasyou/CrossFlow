// Dashboard metrics — extracted from scheduler.ts
import { getDbSync } from './connection';

export function getDashboardMetrics() {
  const db = getDbSync();
  const today = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount
     FROM "order" WHERE date(order_time) = date('now')`
  ).get() as { revenue: number; orderCount: number };
  const yesterday = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount
     FROM "order" WHERE date(order_time) = date('now', '-1 day')`
  ).get() as { revenue: number; orderCount: number };

  const totalAvailable = (db.prepare(
    'SELECT COALESCE(SUM(available), 0) as total FROM inventory'
  ).get() as { total: number }).total;

  const dailyAvgSales = (db.prepare(
    `SELECT COALESCE(CAST(COUNT(*) AS REAL) / 30, 0) as avg FROM "order" WHERE order_time >= date('now', '-30 days')`
  ).get() as { avg: number }).avg;

  const turnoverDays = dailyAvgSales > 0 ? Math.round(totalAvailable / dailyAvgSales) : 0;

  const skuCount = (db.prepare(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM product p
     WHERE p.id IN (SELECT product_id FROM inventory WHERE available > 0 OR reserved > 0 OR in_transit > 0)
        OR p.id IN (SELECT product_id FROM product_platform WHERE status = 'active')`
  ).get() as { count: number }).count;

  return {
    todayRevenue: today.revenue, todayOrderCount: today.orderCount,
    yesterdayRevenue: yesterday.revenue, yesterdayOrderCount: yesterday.orderCount,
    avgInventoryTurnoverDays: turnoverDays, totalSkuCount: skuCount,
  };
}
