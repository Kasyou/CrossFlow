import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc-channels';
import { OrderRepo } from '../db/repositories/order-repo';
import { InventoryRepo } from '../db/repositories/inventory-repo';
import { getDbSync } from '../db/connection';
import { importTemuExcel } from '../sync/temu';
import { checkAllTracking } from '../sync/tracking';
import { checkAllTrackingReal } from '../sync/tracking-real';

function wrap<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (err: any) { console.error('IPC error:', err.message); return { success: false, error: err.message }; }
  }) as unknown as T;
}

export function registerOrdersHandlers(): void {
  ipcMain.handle(IPC.ORDERS_LIST, wrap(async (_e, filter) => {
    const r = OrderRepo.list(filter || {});
    return { rows: r.rows, total: r.total };
  }));
  ipcMain.handle(IPC.ORDERS_GET, wrap(async (_e, id) => OrderRepo.getById(id)));
  ipcMain.handle(IPC.ORDERS_PENDING_COUNT, wrap(async () => OrderRepo.getPendingCount()));

  ipcMain.handle(IPC.ORDERS_UPDATE_STATUS, wrap(async (_e, id, status, trackingNumber) => {
    const order = OrderRepo.getById(id);
    if (!order) return { success: false, message: 'Order not found' };
    OrderRepo.updateStatus(id, status, trackingNumber);
    const wh = getDbSync().prepare('SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1').get() as { id: string } | undefined;
    if (wh && order.product_id) {
      try {
        if (status === 'matched') InventoryRepo.reserve(order.product_id, wh.id, order.quantity, order.id);
        if (status === 'cancelled' || status === 'refunded') InventoryRepo.release(order.product_id, wh.id, order.quantity, order.id);
      } catch (e: any) { console.warn('Inventory sync failed:', e.message); }
    }
    return { success: true };
  }));

  ipcMain.handle(IPC.ORDERS_BATCH_SHIP, wrap(async (_e, ids) => {
    const wh = getDbSync().prepare('SELECT id FROM warehouse WHERE is_default = 1 LIMIT 1').get() as { id: string } | undefined;
    for (const id of ids) {
      const o = OrderRepo.getById(id);
      if (o && o.status === 'matched' && wh && o.product_id) {
        try {
          const inv = InventoryRepo.getByProductWarehouse(o.product_id, wh.id);
          if (inv && inv.reserved >= o.quantity) {
            getDbSync().prepare('UPDATE inventory SET reserved = reserved - ?, updated_at = datetime(\'now\') WHERE id = ?').run(o.quantity, inv.id);
          }
        } catch (e: any) { console.warn('Ship inventory failed:', e.message); }
      }
    }
    OrderRepo.batchUpdateStatus(ids, 'shipped');
    return { success: true };
  }));

  ipcMain.handle(IPC.ORDERS_IMPORT_EXCEL, wrap(async (_e, filePath, platformCode) => {
    if (platformCode === 'temu' || platformCode === 'tiktok') return importTemuExcel(filePath);
    return { orders: [], message: `${platformCode} supports API sync, not Excel import` };
  }));

  // Merge
  ipcMain.handle(IPC.ORDERS_MERGEABLE, wrap(async () => OrderRepo.getMergeableOrders()));
  ipcMain.handle(IPC.ORDERS_MERGE, wrap(async (_e, orderIds: string[]) => {
    if (orderIds.length < 2) return { success: false, message: 'Need at least 2 orders' };
    if (orderIds.length > 20) return { success: false, message: 'Max 20 orders' };
    const all = orderIds.map(id => OrderRepo.getById(id));
    const primary = all[0];
    if (!primary) return { success: false, message: 'Primary order not found' };
    for (let i = 1; i < all.length; i++) {
      const o = all[i];
      if (!o) return { success: false, message: `Order ${orderIds[i]} not found` };
      if (o.sku !== primary.sku) return { success: false, message: `SKU mismatch` };
      if ((o.shipping_address || '') !== (primary.shipping_address || '')) return { success: false, message: 'Address mismatch' };
      if (o.status !== 'pending') return { success: false, message: 'Non-pending order' };
    }
    const totalQty = all.reduce((s, o) => s + (o?.quantity || 0), 0);
    const totalAmt = all.reduce((s, o) => s + parseFloat(String(o?.total_amount || '0')), 0);
    const db = getDbSync();
    db.prepare('UPDATE "order" SET quantity = ?, total_amount = ? WHERE id = ?').run(totalQty, totalAmt, primary.id);
    for (const o of all.slice(1)) { if (o) db.prepare('UPDATE order_item SET order_id = ? WHERE order_id = ?').run(primary.id, o.id); }
    OrderRepo.batchUpdateStatus(orderIds.slice(1), 'cancelled');
    return { success: true, message: `Merged ${orderIds.length} orders, qty: ${totalQty}` };
  }));

  // Tracking
  ipcMain.handle(IPC.TRACKING_CHECK, wrap(async () => {
    try { return await checkAllTrackingReal(); } catch { return checkAllTracking(); }
  }));
}
