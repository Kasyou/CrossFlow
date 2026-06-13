import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc-channels';
import { getDbSync } from '../db/connection';
import { getDashboardMetrics } from '../db/dashboard-metrics';
import { getSkuProfit } from '../db/profit-calculator';

function wrap<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (err: any) { console.error('IPC error:', err.message); return { success: false, error: err.message }; }
  }) as unknown as T;
}

export function registerDashboardHandlers(): void {
  ipcMain.handle(IPC.DASHBOARD_METRICS, wrap(async () => getDashboardMetrics()));

  ipcMain.handle(IPC.DASHBOARD_SALES_TREND, wrap(async (_e, days) => {
    return getDbSync().prepare(
      `SELECT date(o.order_time) as date, COALESCE(SUM(o.total_amount),0) as revenue, COUNT(*) as orderCount,
              o.platform_id as platformId, p.name as platformName
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', ?) GROUP BY date(o.order_time), o.platform_id ORDER BY date(o.order_time)`
    ).all(`-${days || 30} days`);
  }));

  ipcMain.handle(IPC.DASHBOARD_PLATFORM_SHARE, wrap(async () => {
    const rows = getDbSync().prepare(
      `SELECT o.platform_id as platformId, p.name as platformName, COALESCE(SUM(o.total_amount),0) as revenue
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.platform_id ORDER BY revenue DESC`
    ).all() as any[];
    const total = rows.reduce((s: number, r: any) => s + r.revenue, 0);
    return rows.map((r: any) => ({ ...r, percentage: total > 0 ? Math.round((r.revenue / total) * 100) : 0 }));
  }));

  ipcMain.handle(IPC.DASHBOARD_SKU_PROFIT, wrap(async () => getSkuProfit(30)));
}
