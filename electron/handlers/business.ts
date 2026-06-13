import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import { IPC } from '../../src/shared/ipc-channels';
import { getDbSync } from '../db/connection';
import { getStore } from '../store';
import { getSecureSetting } from '../secrets';
import { SupplierRepo } from '../db/repositories/supplier-repo';
import { PurchaseOrderRepo } from '../db/repositories/purchase-order-repo';
import { ReviewRepo } from '../db/repositories/review-repo';
import { authenticate, getAllUsers, createUser, auditLog } from '../auth';
import { syncExchangeRates } from '../sync/exchange-rate';
import { exportOrders, exportInventory, exportProfitReport } from '../export';

function wrap<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (err: any) { console.error('IPC error:', err.message); return { success: false, error: err.message }; }
  }) as unknown as T;
}

export function registerBusinessHandlers(): void {
  // Supplier
  ipcMain.handle(IPC.SUPPLIER_LIST, wrap(async () => SupplierRepo.getAll()));
  ipcMain.handle(IPC.SUPPLIER_CREATE, wrap(async (_e, d) => SupplierRepo.create(d)));
  ipcMain.handle(IPC.SUPPLIER_UPDATE, wrap(async (_e, id, f) => { SupplierRepo.update(id, f); return { success: true }; }));
  ipcMain.handle(IPC.SUPPLIER_DELETE, wrap(async (_e, id) => { SupplierRepo.delete(id); return { success: true }; }));

  // Purchase Order
  ipcMain.handle(IPC.PO_LIST, wrap(async () => PurchaseOrderRepo.getAll()));
  ipcMain.handle(IPC.PO_CREATE, wrap(async (_e, sId, items) => PurchaseOrderRepo.create(sId, items)));
  ipcMain.handle(IPC.PO_UPDATE_STATUS, wrap(async (_e, id, s) => { PurchaseOrderRepo.updateStatus(id, s); return { success: true }; }));
  ipcMain.handle(IPC.PO_DELETE, wrap(async (_e, id) => { PurchaseOrderRepo.delete(id); return { success: true }; }));

  // Reviews
  ipcMain.handle(IPC.REVIEW_LIST, wrap(async (_e, f) => ReviewRepo.getAll(f || {})));
  ipcMain.handle(IPC.REVIEW_ALERTS, wrap(async () => ReviewRepo.getNegativeAlerts()));
  ipcMain.handle(IPC.REVIEW_ACKNOWLEDGE, wrap(async (_e, id) => { ReviewRepo.acknowledgeAlert(id); return { success: true }; }));

  // Freight
  ipcMain.handle(IPC.FREIGHT_LIST, wrap(async () => getDbSync().prepare('SELECT * FROM freight_shipment ORDER BY created_at DESC').all()));
  ipcMain.handle(IPC.FREIGHT_CREATE, wrap(async (_e, d) => {
    const id = uuid();
    getDbSync().prepare(`INSERT INTO freight_shipment (id, shipment_ref, transport_mode, container_number, bl_number, origin, destination, departure_date, estimated_arrival, carrier, total_cbm, total_weight_kg, total_cost, currency, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, d.shipment_ref, d.transport_mode, d.container_number || null, d.bl_number || null, d.origin, d.destination, d.departure_date || null, d.estimated_arrival || null, d.carrier || null, d.total_cbm || 0, d.total_weight_kg || 0, d.total_cost || 0, d.currency || 'USD', d.notes || null);
    return getDbSync().prepare('SELECT * FROM freight_shipment WHERE id = ?').get(id);
  }));

  // Finance
  ipcMain.handle(IPC.FEE_CONFIG_LIST, wrap(async () =>
    getDbSync().prepare('SELECT fc.*, p.name as platform_name FROM fee_config fc LEFT JOIN platform p ON fc.platform_id = p.id').all()
  ));
  ipcMain.handle(IPC.FEE_CONFIG_SAVE, wrap(async (_e, d) => {
    const db = getDbSync();
    const ex = db.prepare('SELECT id FROM fee_config WHERE platform_id = ? AND fee_type = ?').get(d.platform_id, d.fee_type) as any;
    if (ex) db.prepare('UPDATE fee_config SET rate=?, fixed_amount=? WHERE id=?').run(d.rate || 0, d.fixed_amount || 0, ex.id);
    else db.prepare('INSERT INTO fee_config (id, platform_id, fee_type, rate, fixed_amount) VALUES (?,?,?,?,?)').run(uuid(), d.platform_id, d.fee_type, d.rate || 0, d.fixed_amount || 0);
    return { success: true };
  }));
  ipcMain.handle(IPC.FINANCE_EXCHANGE_RATE, wrap(async () => syncExchangeRates()));
  ipcMain.handle(IPC.FINANCE_SUMMARY, wrap(async () => {
    const db = getDbSync();
    const rev = db.prepare(`SELECT o.platform_id as platformId, p.name as platformName, COALESCE(SUM(o.total_amount),0) as totalRevenue, COUNT(DISTINCT o.id) as orderCount FROM "order" o JOIN platform p ON o.platform_id=p.id WHERE o.order_time>=date('now','-30 days') GROUP BY o.platform_id`).all() as any[];
    const fees = db.prepare(`SELECT platform_id, COALESCE(SUM(amount),0) as total FROM platform_fee WHERE recorded_at>=date('now','-30 days') GROUP BY platform_id`).all() as any[];
    const fm: Record<string, number> = {}; fees.forEach((f: any) => { fm[f.platform_id] = f.total; });
    return rev.map((r: any) => ({ ...r, totalFees: fm[r.platformId] || 0, netRevenue: r.totalRevenue - (fm[r.platformId] || 0) }));
  }));

  // Auth
  ipcMain.handle(IPC.AUTH_LOGIN, wrap(async (_e, u, p) => authenticate(u, p)));
  ipcMain.handle(IPC.AUTH_LIST_USERS, wrap(async () => getAllUsers()));
  ipcMain.handle(IPC.AUTH_CREATE_USER, wrap(async (_e, u, p, dn, r) => { const user = createUser(u, p, dn, r); auditLog(user.id, 'user:create', 'user', user.id, `Created ${u}`); return user; }));

  // AI
  ipcMain.handle(IPC.AI_TRANSLATE, wrap(async (_e, text) => {
    const key = getSecureSetting('aiApiKey') || ''; if (!key) return `[No API Key] ${text}`;
    const { getAiAdapter } = require('../ai/adapter');
    return (await getAiAdapter({ provider: getStore().get('aiProvider', 'deepseek'), apiKey: key })).translate(text);
  }));
  ipcMain.handle(IPC.AI_OPTIMIZE_LISTING, wrap(async (_e, t, f) => {
    const key = getSecureSetting('aiApiKey') || ''; if (!key) return '[No API Key]';
    const { getAiAdapter } = require('../ai/adapter');
    return (await getAiAdapter({ provider: getStore().get('aiProvider', 'deepseek'), apiKey: key })).translate(`Optimize listing:\nTitle: ${t}\nFeatures: ${f}`);
  }));
  ipcMain.handle(IPC.AI_CUSTOMER_REPLY, wrap(async (_e, msg, ctx) => {
    const key = getSecureSetting('aiApiKey') || ''; if (!key) return '[No API Key]';
    const { getAiAdapter } = require('../ai/adapter');
    return (await getAiAdapter({ provider: getStore().get('aiProvider', 'deepseek'), apiKey: key })).translate(`Reply to buyer:\nContext: ${ctx}\nMessage: ${msg}`);
  }));

  // Export
  ipcMain.handle(IPC.EXPORT_ORDERS, wrap(async (_e, f) => exportOrders(f)));
  ipcMain.handle(IPC.EXPORT_INVENTORY, wrap(async () => exportInventory()));
  ipcMain.handle(IPC.EXPORT_PROFIT, wrap(async (_e, d) => exportProfitReport(d || 30)));

  // Sync Log
  ipcMain.handle(IPC.SYNC_LOG_RECENT, wrap(async () =>
    getDbSync().prepare('SELECT sl.*, p.name as platform_name FROM sync_log sl LEFT JOIN platform p ON sl.platform_id=p.id ORDER BY sl.finished_at DESC LIMIT 10').all()
  ));
}
