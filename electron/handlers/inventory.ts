import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc-channels';
import { InventoryRepo } from '../db/repositories/inventory-repo';
import { WarehouseRepo } from '../db/repositories/warehouse-repo';
import { getDbSync } from '../db/connection';

function wrap<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (err: any) { console.error('IPC error:', err.message); return { success: false, error: err.message }; }
  }) as unknown as T;
}

export function registerInventoryHandlers(): void {
  ipcMain.handle(IPC.INVENTORY_LIST, wrap(async () => InventoryRepo.getAllWithDetails()));
  ipcMain.handle(IPC.INVENTORY_LOW_STOCK, wrap(async () => InventoryRepo.getLowStock()));
  ipcMain.handle(IPC.INVENTORY_RESTOCK, wrap(async (_e, pid, wid, qty, note) => { InventoryRepo.restock(pid, wid, qty, note); return { success: true }; }));
  ipcMain.handle(IPC.INVENTORY_RECEIVE, wrap(async (_e, pid, wid, qty) => { InventoryRepo.receiveRestock(pid, wid, qty); return { success: true }; }));
  ipcMain.handle(IPC.INVENTORY_LOGS, wrap(async (_e, pid, limit) => InventoryRepo.getLogs(pid, limit || 50)));
  ipcMain.handle(IPC.INVENTORY_RESTOCK_SUGGESTIONS, wrap(async () => InventoryRepo.getRestockSuggestions()));
  ipcMain.handle(IPC.INVENTORY_PAUSE_SKU, wrap(async (_e, sku: string) => {
    const p = getDbSync().prepare('SELECT id FROM product WHERE sku = ?').get(String(sku ?? '')) as any;
    if (!p) return { success: false, message: 'SKU not found' };
    getDbSync().prepare("UPDATE product_platform SET status = 'paused' WHERE product_id = ? AND status = 'active'").run(p.id);
    return { success: true, message: `Paused ${sku}` };
  }));

  ipcMain.handle(IPC.WAREHOUSE_LIST, wrap(async () => WarehouseRepo.getAll()));
  ipcMain.handle(IPC.WAREHOUSE_CREATE, wrap(async (_e, n, t, c) => WarehouseRepo.create(n, t, c)));
  ipcMain.handle(IPC.WAREHOUSE_UPDATE, wrap(async (_e, id, f) => { WarehouseRepo.update(id, f); return { success: true }; }));
  ipcMain.handle(IPC.WAREHOUSE_DELETE, wrap(async (_e, id) => { WarehouseRepo.delete(id); return { success: true }; }));
  ipcMain.handle(IPC.WAREHOUSE_SET_DEFAULT, wrap(async (_e, id) => { WarehouseRepo.setDefault(id); return { success: true }; }));
}
