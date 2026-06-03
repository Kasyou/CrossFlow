import { ipcMain } from 'electron';
import { IPC } from '../src/shared/ipc-channels';
import { OrderRepo } from './db/repositories/order-repo';
import { InventoryRepo } from './db/repositories/inventory-repo';
import { WarehouseRepo } from './db/repositories/warehouse-repo';
import { ProductRepo } from './db/repositories/product-repo';
import { PlatformRepo } from './db/repositories/platform-repo';
import { SyncLogRepo } from './db/repositories/sync-log-repo';
import { getDbSync } from './db/connection';
import { runManualSync } from './sync/scheduler';
import { getDashboardMetrics } from './sync/scheduler';
import { importTemuExcel } from './sync/temu';

export function registerIpcHandlers(): void {
  // ---- Orders ----
  ipcMain.handle(IPC.ORDERS_LIST, async (_e, filter) => {
    const result = OrderRepo.list(filter || {});
    return { rows: result.rows, total: result.total };
  });

  ipcMain.handle(IPC.ORDERS_GET, async (_e, id) => {
    return OrderRepo.getById(id);
  });

  ipcMain.handle(IPC.ORDERS_UPDATE_STATUS, async (_e, id, status, trackingNumber) => {
    OrderRepo.updateStatus(id, status, trackingNumber);
  });

  ipcMain.handle(IPC.ORDERS_BATCH_SHIP, async (_e, ids) => {
    OrderRepo.batchUpdateStatus(ids, 'shipped');
  });

  ipcMain.handle(IPC.ORDERS_PENDING_COUNT, async () => {
    return OrderRepo.getPendingCount();
  });

  ipcMain.handle(IPC.ORDERS_IMPORT_EXCEL, async (_e, filePath, _platformCode) => {
    return importTemuExcel(filePath);
  });

  // ---- Inventory ----
  ipcMain.handle(IPC.INVENTORY_LIST, async () => {
    return InventoryRepo.getAllWithDetails();
  });

  ipcMain.handle(IPC.INVENTORY_LOW_STOCK, async () => {
    return InventoryRepo.getLowStock();
  });

  ipcMain.handle(IPC.INVENTORY_RESTOCK, async (_e, productId, warehouseId, quantity, note) => {
    InventoryRepo.restock(productId, warehouseId, quantity, note);
  });

  ipcMain.handle(IPC.INVENTORY_RECEIVE, async (_e, productId, warehouseId, quantity) => {
    InventoryRepo.receiveRestock(productId, warehouseId, quantity);
  });

  ipcMain.handle(IPC.INVENTORY_LOGS, async (_e, productId, limit) => {
    return InventoryRepo.getLogs(productId, limit || 50);
  });

  // ---- Warehouse ----
  ipcMain.handle(IPC.WAREHOUSE_LIST, async () => {
    return WarehouseRepo.getAll();
  });

  ipcMain.handle(IPC.WAREHOUSE_CREATE, async (_e, name, type, country) => {
    return WarehouseRepo.create(name, type, country);
  });

  ipcMain.handle(IPC.WAREHOUSE_UPDATE, async (_e, id, fields) => {
    WarehouseRepo.update(id, fields);
  });

  ipcMain.handle(IPC.WAREHOUSE_DELETE, async (_e, id) => {
    WarehouseRepo.delete(id);
  });

  ipcMain.handle(IPC.WAREHOUSE_SET_DEFAULT, async (_e, id) => {
    WarehouseRepo.setDefault(id);
  });

  // ---- Product ----
  ipcMain.handle(IPC.PRODUCT_LIST, async () => {
    return ProductRepo.getAll();
  });

  ipcMain.handle(IPC.PRODUCT_SEARCH, async (_e, query) => {
    return ProductRepo.search(query);
  });

  ipcMain.handle(IPC.PRODUCT_CREATE, async (_e, data) => {
    return ProductRepo.create(data);
  });

  ipcMain.handle(IPC.PRODUCT_UPDATE, async (_e, sku, fields) => {
    ProductRepo.update(sku, fields);
  });

  ipcMain.handle(IPC.PRODUCT_DELETE, async (_e, sku) => {
    ProductRepo.deleteBySku(sku);
  });

  // ---- Platform ----
  ipcMain.handle(IPC.PLATFORM_LIST, async () => {
    const rows = PlatformRepo.getAll();
    return rows.map(r => ({
      ...r,
      authConfigured: !!r.auth_data,
    }));
  });

  ipcMain.handle(IPC.PLATFORM_SAVE_AUTH, async (_e, code, authData) => {
    PlatformRepo.updateAuth(code, JSON.stringify(authData));
  });

  ipcMain.handle(IPC.PLATFORM_TOGGLE_SYNC, async (_e, code, enabled) => {
    PlatformRepo.setSyncEnabled(code, enabled);
  });

  ipcMain.handle(IPC.PLATFORM_SYNC_NOW, async (_e, code) => {
    return runManualSync(code);
  });

  // ---- Dashboard ----
  ipcMain.handle(IPC.DASHBOARD_METRICS, async () => {
    return getDashboardMetrics();
  });

  ipcMain.handle(IPC.DASHBOARD_SALES_TREND, async (_e, days) => {
    const rows = getDbSync().prepare(
      `SELECT date(o.order_time) as date, COALESCE(SUM(o.total_amount),0) as revenue, COUNT(*) as orderCount, o.platform_id as platformId, p.name as platformName
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', ?) GROUP BY date(o.order_time), o.platform_id ORDER BY date(o.order_time)`
    ).all(`-${days || 30} days`);
    return rows;
  });

  ipcMain.handle(IPC.DASHBOARD_PLATFORM_SHARE, async () => {
    const rows = getDbSync().prepare(
      `SELECT o.platform_id as platformId, p.name as platformName, COALESCE(SUM(o.total_amount),0) as revenue
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.platform_id ORDER BY revenue DESC`
    ).all() as any[];
    const total = rows.reduce((sum: number, r: any) => sum + r.revenue, 0);
    return rows.map((r: any) => ({ ...r, percentage: total > 0 ? Math.round((r.revenue / total) * 100) : 0 }));
  });

  ipcMain.handle(IPC.DASHBOARD_SKU_PROFIT, async () => {
    const { getDbSync } = require('./db/connection');
    return getDbSync().prepare(
      `SELECT o.sku, p.name as productName, COUNT(*) as orderCount, COALESCE(SUM(o.total_amount),0) as revenue,
              COALESCE(SUM(o.total_amount) - COUNT(*) * p.cost_price, 0) as estimatedProfit
       FROM "order" o JOIN product p ON o.sku = p.sku
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.sku ORDER BY estimatedProfit DESC LIMIT 20`
    ).all();
  });

  // ---- Settings ----
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    const Store = require('electron-store');
    const store = new Store({ encryptionKey: 'crossflow-settings' });
    return {
      language: store.get('language', 'zh-CN'),
      autoLaunch: store.get('autoLaunch', false),
      minimizeToTray: store.get('minimizeToTray', true),
      aiProvider: store.get('aiProvider', 'deepseek'),
      aiApiKey: store.get('aiApiKey', ''),
      backupPath: store.get('backupPath', ''),
    };
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, key, value) => {
    const Store = require('electron-store');
    const store = new Store({ encryptionKey: 'crossflow-settings' });
    store.set(key, value);
  });
}
