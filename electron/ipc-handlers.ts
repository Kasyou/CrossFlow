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
    const order = OrderRepo.getById(id);
    if (!order) return { success: false, message: 'Order not found' };

    OrderRepo.updateStatus(id, status, trackingNumber);

    // Auto-trigger inventory operations on status change
    if (status === 'matched' && order.product_id) {
      // Reserve stock in the default domestic warehouse
      const defaultWh = getDbSync().prepare(
        'SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1'
      ).get() as { id: string } | undefined;
      if (defaultWh) {
        try {
          InventoryRepo.reserve(order.product_id, defaultWh.id, order.quantity, order.id);
        } catch (e: any) {
          console.warn(`Failed to reserve inventory for order ${order.id}: ${e.message}`);
        }
      }
    }

    if ((status === 'cancelled' || status === 'refunded') && order.product_id) {
      const defaultWh = getDbSync().prepare(
        'SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1'
      ).get() as { id: string } | undefined;
      if (defaultWh) {
        try {
          InventoryRepo.release(order.product_id, defaultWh.id, order.quantity, order.id);
        } catch (e: any) {
          console.warn(`Failed to release inventory for order ${order.id}: ${e.message}`);
        }
      }
    }

    return { success: true };
  }));

  ipcMain.handle(IPC.ORDERS_BATCH_SHIP, wrapHandler(async (_e, ids) => {
    for (const id of ids) {
      const order = OrderRepo.getById(id);
      if (order && order.status === 'matched') {
        // Deduct from available/reserved when shipping
        const defaultWh = getDbSync().prepare(
          'SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1'
        ).get() as { id: string } | undefined;
        if (defaultWh && order.product_id) {
          try {
            // Release the reserve first, then let the shipped status reflect actual deduction
            // The existing UPDATE in updateStatus already handles the status change
            // Here we just ensure the reserved qty is released on ship
            const inv = InventoryRepo.getByProductWarehouse(order.product_id, defaultWh.id);
            if (inv && inv.reserved >= order.quantity) {
              InventoryRepo.release(order.product_id, defaultWh.id, order.quantity, order.id);
            }
          } catch (e: any) {
            console.warn(`Failed to adjust inventory for shipped order ${order.id}: ${e.message}`);
          }
        }
      }
    }
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
    if (orderIds.length > 20) return { success: false, message: 'Cannot merge more than 20 orders at once' };

    // Secondary validation: verify all orders match on SKU, address, and status
    const allOrders = orderIds.map(id => OrderRepo.getById(id));
    const primary = allOrders[0];
    if (!primary) return { success: false, message: 'Primary order not found' };

    for (let i = 1; i < allOrders.length; i++) {
      const o = allOrders[i];
      if (!o) return { success: false, message: `Order ${orderIds[i]} not found` };
      if (o.sku !== primary.sku) return { success: false, message: `SKU mismatch: ${primary.sku} vs ${o.sku}` };
      if ((o.shipping_address || '') !== (primary.shipping_address || '')) {
        return { success: false, message: 'Shipping address mismatch — cannot merge orders with different addresses' };
      }
      if (o.status !== 'pending') return { success: false, message: `Cannot merge non-pending orders (${o.platform_order_id} is ${o.status})` };
    }

    const totalQty = allOrders.reduce((sum, o) => sum + (o?.quantity || 0), 0);
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
      `SELECT
        o.sku,
        p.name as productName,
        COUNT(DISTINCT o.id) as orderCount,
        COALESCE(SUM(o.total_amount), 0) as revenue,
        COALESCE(SUM(o.quantity * p.cost_price), 0) as purchaseCost,
        COALESCE(SUM(o.total_amount * fc_comm.rate), 0) as commissionFees,
        COALESCE(SUM(o.total_amount * fc_pay.rate + fc_pay.fixed_amount), 0) as paymentFees,
        COALESCE(SUM(oc.amount), 0) as otherCosts,
        COALESCE(
          SUM(o.total_amount)
          - SUM(o.quantity * p.cost_price)
          - SUM(o.total_amount * COALESCE(fc_comm.rate, 0))
          - SUM(o.total_amount * COALESCE(fc_pay.rate, 0) + COALESCE(fc_pay.fixed_amount, 0))
          - COALESCE(SUM(oc.amount), 0),
          0
        ) as estimatedProfit
       FROM "order" o
       JOIN product p ON o.sku = p.sku
       LEFT JOIN fee_config fc_comm ON o.platform_id = fc_comm.platform_id AND fc_comm.fee_type = 'commission'
       LEFT JOIN fee_config fc_pay ON o.platform_id = fc_pay.platform_id AND fc_pay.fee_type = 'payment'
       LEFT JOIN order_cost oc ON o.id = oc.order_id
       WHERE o.order_time >= date('now', '-30 days')
       GROUP BY o.sku
       ORDER BY estimatedProfit DESC
       LIMIT 20`
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
