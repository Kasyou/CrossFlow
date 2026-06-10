import { ipcMain } from 'electron';
import { IPC } from '../src/shared/ipc-channels';
import { OrderRepo } from './db/repositories/order-repo';
import { InventoryRepo } from './db/repositories/inventory-repo';
import { WarehouseRepo } from './db/repositories/warehouse-repo';
import { ProductRepo } from './db/repositories/product-repo';
import { PlatformRepo } from './db/repositories/platform-repo';
import { getDbSync } from './db/connection';
import { getStore } from './store';
import { runManualSync } from './sync/scheduler';
import { getDashboardMetrics } from './sync/scheduler';
import { importTemuExcel } from './sync/temu';

function wrapHandler<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err: any) {
      console.error(`IPC handler error:`, err.message || err);
      return { success: false, error: err.message || 'Internal error' };
    }
  }) as unknown as T;
}

export function registerIpcHandlers(): void {
  // ---- Orders ----
  ipcMain.handle(IPC.ORDERS_LIST, wrapHandler(async (_e, filter) => {
    const result = OrderRepo.list(filter || {});
    return { rows: result.rows, total: result.total };
  }));

  ipcMain.handle(IPC.ORDERS_GET, wrapHandler(async (_e, id) => {
    return OrderRepo.getById(id);
  }));

  ipcMain.handle(IPC.ORDERS_UPDATE_STATUS, wrapHandler(async (_e, id, status, trackingNumber) => {
    OrderRepo.updateStatus(id, status, trackingNumber);
    return { success: true };
  }));

  ipcMain.handle(IPC.ORDERS_BATCH_SHIP, wrapHandler(async (_e, ids) => {
    OrderRepo.batchUpdateStatus(ids, 'shipped');
    return { success: true };
  }));

  ipcMain.handle(IPC.ORDERS_PENDING_COUNT, wrapHandler(async () => {
    return OrderRepo.getPendingCount();
  }));

  ipcMain.handle(IPC.ORDERS_IMPORT_EXCEL, wrapHandler(async (_e, filePath, platformCode) => {
    switch (platformCode) {
      case 'temu': return importTemuExcel(filePath);
      default: return importTemuExcel(filePath);
    }
  }));

  // ---- Inventory ----
  ipcMain.handle(IPC.INVENTORY_LIST, wrapHandler(async () => {
    return InventoryRepo.getAllWithDetails();
  }));

  ipcMain.handle(IPC.INVENTORY_LOW_STOCK, wrapHandler(async () => {
    return InventoryRepo.getLowStock();
  }));

  ipcMain.handle(IPC.INVENTORY_RESTOCK, wrapHandler(async (_e, productId, warehouseId, quantity, note) => {
    InventoryRepo.restock(productId, warehouseId, quantity, note);
    return { success: true };
  }));

  ipcMain.handle(IPC.INVENTORY_RECEIVE, wrapHandler(async (_e, productId, warehouseId, quantity) => {
    InventoryRepo.receiveRestock(productId, warehouseId, quantity);
    return { success: true };
  }));

  ipcMain.handle(IPC.INVENTORY_LOGS, wrapHandler(async (_e, productId, limit) => {
    return InventoryRepo.getLogs(productId, limit || 50);
  }));

  ipcMain.handle(IPC.INVENTORY_PAUSE_SKU, wrapHandler(async (_e, sku: string) => {
    const skuStr = String(sku ?? '');
    const product = getDbSync().prepare('SELECT id FROM product WHERE sku = ?').get(skuStr) as any;
    if (!product) return { success: false, message: 'SKU not found' };
    getDbSync().prepare(
      `UPDATE product_platform SET status = 'paused' WHERE product_id = ? AND status = 'active'`
    ).run(product.id);
    return { success: true, message: `已暂停 ${sku} 在所有平台的销售` };
  }));

  ipcMain.handle(IPC.INVENTORY_RESTOCK_SUGGESTIONS, wrapHandler(async () => {
    return InventoryRepo.getRestockSuggestions();
  }));

  // ---- Warehouse ----
  ipcMain.handle(IPC.WAREHOUSE_LIST, wrapHandler(async () => {
    return WarehouseRepo.getAll();
  }));

  ipcMain.handle(IPC.WAREHOUSE_CREATE, wrapHandler(async (_e, name, type, country) => {
    return WarehouseRepo.create(name, type, country);
  }));

  ipcMain.handle(IPC.WAREHOUSE_UPDATE, wrapHandler(async (_e, id, fields) => {
    WarehouseRepo.update(id, fields);
    return { success: true };
  }));

  ipcMain.handle(IPC.WAREHOUSE_DELETE, wrapHandler(async (_e, id) => {
    WarehouseRepo.delete(id);
    return { success: true };
  }));

  ipcMain.handle(IPC.WAREHOUSE_SET_DEFAULT, wrapHandler(async (_e, id) => {
    WarehouseRepo.setDefault(id);
    return { success: true };
  }));

  // ---- Product ----
  ipcMain.handle(IPC.PRODUCT_LIST, wrapHandler(async () => {
    return ProductRepo.getAll();
  }));

  ipcMain.handle(IPC.PRODUCT_SEARCH, wrapHandler(async (_e, query) => {
    return ProductRepo.search(query);
  }));

  ipcMain.handle(IPC.PRODUCT_CREATE, wrapHandler(async (_e, data) => {
    return ProductRepo.create(data);
  }));

  ipcMain.handle(IPC.PRODUCT_UPDATE, wrapHandler(async (_e, sku, fields) => {
    ProductRepo.update(sku, fields);
    return { success: true };
  }));

  ipcMain.handle(IPC.PRODUCT_DELETE, wrapHandler(async (_e, sku) => {
    ProductRepo.deleteBySku(sku);
    return { success: true };
  }));

  // ---- Platform ----
  ipcMain.handle(IPC.PLATFORM_LIST, wrapHandler(async () => {
    const rows = PlatformRepo.getAll();
    return rows.map(r => ({
      ...r,
      authConfigured: !!r.auth_data,
    }));
  }));

  ipcMain.handle(IPC.PLATFORM_SAVE_AUTH, wrapHandler(async (_e, code, authData) => {
    PlatformRepo.updateAuth(code, JSON.stringify(authData));
    return { success: true };
  }));

  ipcMain.handle(IPC.PLATFORM_TOGGLE_SYNC, wrapHandler(async (_e, code, enabled) => {
    PlatformRepo.setSyncEnabled(code, enabled);
    return { success: true };
  }));

  ipcMain.handle(IPC.PLATFORM_SYNC_NOW, wrapHandler(async (_e, code) => {
    return runManualSync(code);
  }));

  // ---- Order Merge ----
  ipcMain.handle(IPC.ORDERS_MERGEABLE, wrapHandler(async () => {
    return OrderRepo.getMergeableOrders();
  }));

  ipcMain.handle(IPC.ORDERS_MERGE, wrapHandler(async (_e, orderIds: string[]) => {
    if (orderIds.length < 2) return { success: false, message: 'Need at least 2 orders' };
    const primary = OrderRepo.getById(orderIds[0]);
    if (!primary) return { success: false, message: 'Primary order not found' };
    const totalQty = orderIds.reduce((sum, id) => {
      const o = OrderRepo.getById(id);
      return sum + (o?.quantity || 0);
    }, 0);
    getDbSync().prepare('UPDATE "order" SET quantity = ? WHERE id = ?').run(totalQty, primary.id);
    OrderRepo.batchUpdateStatus(orderIds.slice(1), 'cancelled');
    return { success: true, message: `已合并 ${orderIds.length} 个订单，总数量：${totalQty}` };
  }));

  // ---- Logistics Tracking ----
  ipcMain.handle(IPC.TRACKING_CHECK, wrapHandler(async () => {
    const { checkAllTracking } = require('./sync/tracking');
    return checkAllTracking();
  }));

  // ---- AI Translation ----
  ipcMain.handle(IPC.AI_TRANSLATE, wrapHandler(async (_e, text) => {
    const store = getStore();
    const provider = store.get('aiProvider', 'deepseek');
    const apiKey = store.get('aiApiKey', '');
    if (!apiKey) return `[请在设置中配置AI API Key] ${text}`;
    const { getAiAdapter } = require('./ai/adapter');
    const adapter = getAiAdapter({ provider, apiKey });
    if (!adapter) return `[AI未配置] ${text}`;
    return await adapter.translate(text);
  }));

  // ---- Dashboard ----
  ipcMain.handle(IPC.DASHBOARD_METRICS, wrapHandler(async () => {
    return getDashboardMetrics();
  }));

  ipcMain.handle(IPC.DASHBOARD_SALES_TREND, wrapHandler(async (_e, days) => {
    const rows = getDbSync().prepare(
      `SELECT date(o.order_time) as date, COALESCE(SUM(o.total_amount),0) as revenue, COUNT(*) as orderCount, o.platform_id as platformId, p.name as platformName
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', ?) GROUP BY date(o.order_time), o.platform_id ORDER BY date(o.order_time)`
    ).all(`-${days || 30} days`);
    return rows;
  }));

  ipcMain.handle(IPC.DASHBOARD_PLATFORM_SHARE, wrapHandler(async () => {
    const rows = getDbSync().prepare(
      `SELECT o.platform_id as platformId, p.name as platformName, COALESCE(SUM(o.total_amount),0) as revenue
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.platform_id ORDER BY revenue DESC`
    ).all() as any[];
    const total = rows.reduce((sum: number, r: any) => sum + r.revenue, 0);
    return rows.map((r: any) => ({ ...r, percentage: total > 0 ? Math.round((r.revenue / total) * 100) : 0 }));
  }));

  ipcMain.handle(IPC.DASHBOARD_SKU_PROFIT, wrapHandler(async () => {
    return getDbSync().prepare(
      `SELECT o.sku, p.name as productName, COUNT(*) as orderCount, COALESCE(SUM(o.total_amount),0) as revenue,
              COALESCE(SUM(o.total_amount) - COUNT(*) * p.cost_price, 0) as estimatedProfit
       FROM "order" o JOIN product p ON o.sku = p.sku
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.sku ORDER BY estimatedProfit DESC LIMIT 20`
    ).all();
  }));

  // ---- Settings ----
  ipcMain.handle(IPC.SETTINGS_GET, wrapHandler(async () => {
    const store = getStore();
    return {
      language: store.get('language', 'zh-CN'),
      autoLaunch: store.get('autoLaunch', false),
      minimizeToTray: store.get('minimizeToTray', true),
      aiProvider: store.get('aiProvider', 'deepseek'),
      aiApiKey: store.get('aiApiKey', ''),
      backupPath: store.get('backupPath', ''),
    };
  }));

  ipcMain.handle(IPC.SETTINGS_SET, wrapHandler(async (_e, key, value) => {
    const store = getStore();
    store.set(key, value);
    return { success: true };
  }));
}
