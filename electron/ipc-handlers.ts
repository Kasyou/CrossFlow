import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import { IPC } from '../src/shared/ipc-channels';
import { OrderRepo } from './db/repositories/order-repo';
import { InventoryRepo } from './db/repositories/inventory-repo';
import { WarehouseRepo } from './db/repositories/warehouse-repo';
import { ProductRepo } from './db/repositories/product-repo';
import { PlatformRepo } from './db/repositories/platform-repo';
import { getDbSync } from './db/connection';
import { getStore } from './store';
import { getSecureSetting, setSecureSetting } from './secrets';
import { runManualSync } from './sync/scheduler';
import { getDashboardMetrics } from './sync/scheduler';
import { importTemuExcel } from './sync/temu';
import { SupplierRepo } from './db/repositories/supplier-repo';
import { PurchaseOrderRepo } from './db/repositories/purchase-order-repo';
import { ReviewRepo } from './db/repositories/review-repo';
import { checkAllTracking } from './sync/tracking';
import { checkAllTrackingReal } from './sync/tracking-real';
import { authenticate, getAllUsers, createUser, auditLog } from './auth';
import { syncExchangeRates } from './sync/exchange-rate';
import { exportOrders, exportInventory, exportProfitReport } from './export';

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
      case 'temu':
      case 'tiktok':
        return importTemuExcel(filePath);
      case 'amazon':
      case 'shopee':
      case 'lazada':
        return { orders: [], message: `${platformCode} supports API sync. Use the sync button instead of Excel import.` };
      default:
        return importTemuExcel(filePath);
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
    const db = getDbSync();
    // Update order quantity and merge order_items from cancelled orders
    db.prepare('UPDATE "order" SET quantity = ? WHERE id = ?').run(totalQty, primary.id);
    for (const o of allOrders.slice(1)) {
      if (o) {
        db.prepare('UPDATE order_item SET order_id = ? WHERE order_id = ?').run(primary.id, o.id);
      }
    }
    OrderRepo.batchUpdateStatus(orderIds.slice(1), 'cancelled');
    return { success: true, message: `已合并 ${orderIds.length} 个订单，总数量：${totalQty}` };
  }));

  // ---- Logistics Tracking ----
  ipcMain.handle(IPC.TRACKING_CHECK, wrapHandler(async () => {
    // Try real tracking API first, fall back to warehouse-type heuristic
    try {
      return await checkAllTrackingReal();
    } catch {
      return checkAllTracking();
    }
  }));

  // ---- AI Translation ----
  ipcMain.handle(IPC.AI_TRANSLATE, wrapHandler(async (_e, text) => {
    const store = getStore();
    const provider = store.get('aiProvider', 'deepseek');
    const apiKey = getSecureSetting('aiApiKey') || '';
    if (!apiKey) return `[请在设置中配置AI API Key] ${text}`;
    const { getAiAdapter } = require('./ai/adapter');
    const adapter = getAiAdapter({ provider, apiKey });
    if (!adapter) return `[AI未配置] ${text}`;
    return await adapter.translate(text);
  }));

  ipcMain.handle('ai:optimizeListing', wrapHandler(async (_e, title, features) => {
    const store = getStore();
    const apiKey = getSecureSetting('aiApiKey') || '';
    if (!apiKey) return '[请在设置中配置AI API Key]';
    const { getAiAdapter } = require('./ai/adapter');
    const adapter = getAiAdapter({ provider: store.get('aiProvider', 'deepseek'), apiKey });
    if (!adapter) return '[AI未配置]';
    const prompt = `Optimize this e-commerce product listing for Amazon/Shopee:\nTitle: ${title}\nFeatures: ${features}\n\nProvide:\n1. Optimized title (SEO-friendly, under 200 chars)\n2. 5 bullet points highlighting key features\n3. Suggested search terms\n\nResponse in the same language as the input:`;
    return await adapter.translate(prompt);
  }));

  ipcMain.handle('ai:customerReply', wrapHandler(async (_e, buyerMessage, orderContext) => {
    const store = getStore();
    const apiKey = getSecureSetting('aiApiKey') || '';
    if (!apiKey) return '[请在设置中配置AI API Key]';
    const { getAiAdapter } = require('./ai/adapter');
    const adapter = getAiAdapter({ provider: store.get('aiProvider', 'deepseek'), apiKey });
    if (!adapter) return '[AI未配置]';
    const prompt = `You are a customer service agent for a cross-border e-commerce store. Write a polite, professional reply to the buyer's message.\n\nOrder context: ${orderContext}\nBuyer message: ${buyerMessage}\n\nReply (keep it concise, 2-3 sentences, in the same language as the buyer's message):`;
    return await adapter.translate(prompt);
  }));

  // ---- Supplier ----
  ipcMain.handle('supplier:list', wrapHandler(async () => {
    return SupplierRepo.getAll();
  }));

  ipcMain.handle('supplier:create', wrapHandler(async (_e, data) => {
    return SupplierRepo.create(data);
  }));

  ipcMain.handle('supplier:update', wrapHandler(async (_e, id, fields) => {
    SupplierRepo.update(id, fields);
    return { success: true };
  }));

  ipcMain.handle('supplier:delete', wrapHandler(async (_e, id) => {
    SupplierRepo.delete(id);
    return { success: true };
  }));

  // ---- Purchase Order ----
  ipcMain.handle('po:list', wrapHandler(async () => {
    return PurchaseOrderRepo.getAll();
  }));

  ipcMain.handle('po:create', wrapHandler(async (_e, supplierId, items) => {
    return PurchaseOrderRepo.create(supplierId, items);
  }));

  ipcMain.handle('po:updateStatus', wrapHandler(async (_e, id, status) => {
    PurchaseOrderRepo.updateStatus(id, status);
    return { success: true };
  }));

  ipcMain.handle('po:delete', wrapHandler(async (_e, id) => {
    PurchaseOrderRepo.delete(id);
    return { success: true };
  }));

  // ---- Reviews ----
  ipcMain.handle('review:list', wrapHandler(async (_e, filter) => {
    return ReviewRepo.getAll(filter || {});
  }));

  ipcMain.handle('review:alerts', wrapHandler(async () => {
    return ReviewRepo.getNegativeAlerts();
  }));

  ipcMain.handle('review:acknowledge', wrapHandler(async (_e, alertId) => {
    ReviewRepo.acknowledgeAlert(alertId);
    return { success: true };
  }));

  // ---- Fee Config ----
  ipcMain.handle('feeConfig:list', wrapHandler(async () => {
    return getDbSync().prepare(
      `SELECT fc.*, p.name as platform_name FROM fee_config fc LEFT JOIN platform p ON fc.platform_id = p.id`
    ).all();
  }));

  ipcMain.handle('feeConfig:save', wrapHandler(async (_e, data) => {
    const db = getDbSync();
    const existing = db.prepare('SELECT id FROM fee_config WHERE platform_id = ? AND fee_type = ?').get(data.platform_id, data.fee_type) as any;
    if (existing) {
      db.prepare('UPDATE fee_config SET rate = ?, fixed_amount = ? WHERE id = ?').run(data.rate || 0, data.fixed_amount || 0, existing.id);
    } else {
      db.prepare('INSERT INTO fee_config (id, platform_id, fee_type, rate, fixed_amount) VALUES (?, ?, ?, ?, ?)').run(uuid(), data.platform_id, data.fee_type, data.rate || 0, data.fixed_amount || 0);
    }
    return { success: true };
  }));

  // ---- Finance ----
  ipcMain.handle('finance:exchangeRate', wrapHandler(async () => {
    const result = await syncExchangeRates();
    return result;
  }));

  ipcMain.handle('finance:summary', wrapHandler(async () => {
    const db = getDbSync();
    const revenue = db.prepare(
      `SELECT o.platform_id as platformId, p.name as platformName,
              COALESCE(SUM(o.total_amount), 0) as totalRevenue,
              COUNT(DISTINCT o.id) as orderCount,
              o.currency
       FROM "order" o
       JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', '-30 days')
       GROUP BY o.platform_id`
    ).all() as any[];

    const totalFees = db.prepare(
      `SELECT pf.platform_id, COALESCE(SUM(pf.amount), 0) as total
       FROM platform_fee pf
       WHERE pf.recorded_at >= date('now', '-30 days')
       GROUP BY pf.platform_id`
    ).all() as any[];

    const feeMap: Record<string, number> = {};
    totalFees.forEach((f: any) => { feeMap[f.platform_id] = f.total; });

    return revenue.map((r: any) => ({
      ...r,
      totalFees: feeMap[r.platformId] || 0,
      netRevenue: r.totalRevenue - (feeMap[r.platformId] || 0),
    }));
  }));

  // ---- Auth ----
  ipcMain.handle('auth:login', wrapHandler(async (_e, username, password) => {
    return authenticate(username, password);
  }));

  ipcMain.handle('auth:listUsers', wrapHandler(async () => {
    return getAllUsers();
  }));

  ipcMain.handle('auth:createUser', wrapHandler(async (_e, username, password, displayName, role) => {
    const user = createUser(username, password, displayName, role);
    auditLog(user.id, 'user:create', 'user', user.id, `Created user ${username} with role ${role}`);
    return user;
  }));

  // ---- Freight ----
  ipcMain.handle('freight:list', wrapHandler(async () => {
    return getDbSync().prepare(
      `SELECT * FROM freight_shipment ORDER BY created_at DESC`
    ).all();
  }));

  ipcMain.handle('freight:create', wrapHandler(async (_e, data) => {
    const db = getDbSync();
    const id = uuid();
    db.prepare(
      `INSERT INTO freight_shipment (id, shipment_ref, transport_mode, container_number, bl_number,
         origin, destination, departure_date, estimated_arrival, carrier, total_cbm, total_weight_kg, total_cost, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.shipment_ref, data.transport_mode, data.container_number || null, data.bl_number || null,
      data.origin, data.destination, data.departure_date || null, data.estimated_arrival || null,
      data.carrier || null, data.total_cbm || 0, data.total_weight_kg || 0, data.total_cost || 0, data.currency || 'USD', data.notes || null);
    return getDbSync().prepare('SELECT * FROM freight_shipment WHERE id = ?').get(id);
  }));

  // ---- Export ----
  ipcMain.handle('export:orders', wrapHandler(async (_e, filter) => {
    return exportOrders(filter);
  }));

  ipcMain.handle('export:inventory', wrapHandler(async () => {
    return exportInventory();
  }));

  ipcMain.handle('export:profitReport', wrapHandler(async (_e, days) => {
    return exportProfitReport(days || 30);
  }));

  // ---- Sync Log ----
  ipcMain.handle('syncLog:recent', wrapHandler(async () => {
    return getDbSync().prepare(
      `SELECT sl.*, p.name as platform_name
       FROM sync_log sl LEFT JOIN platform p ON sl.platform_id = p.id
       ORDER BY sl.finished_at DESC LIMIT 10`
    ).all();
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
      aiApiKeyConfigured: !!(getSecureSetting('aiApiKey')),
      trackingApiKeyConfigured: !!(getSecureSetting('trackingApiKey')),
      backupPath: store.get('backupPath', ''),
    };
  }));

  ipcMain.handle(IPC.SETTINGS_SET, wrapHandler(async (_e, key, value) => {
    // Secure keys go to safeStorage; plain keys go to electron-store
    if (key === 'aiApiKey' || key === 'trackingApiKey') {
      setSecureSetting(key, String(value));
    } else {
      const store = getStore();
      store.set(key, value);
    }
    return { success: true };
  }));
}
