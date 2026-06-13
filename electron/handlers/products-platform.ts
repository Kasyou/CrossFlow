import { ipcMain } from 'electron';
import { IPC } from '../../src/shared/ipc-channels';
import { ProductRepo } from '../db/repositories/product-repo';
import { PlatformRepo } from '../db/repositories/platform-repo';
import { getStore } from '../store';
import { getSecureSetting, setSecureSetting } from '../secrets';
import { runManualSync } from '../sync/scheduler';

function wrap<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    try { return await fn(...args); }
    catch (err: any) { console.error('IPC error:', err.message); return { success: false, error: err.message }; }
  }) as unknown as T;
}

export function registerProductsPlatformHandlers(): void {
  // Products
  ipcMain.handle(IPC.PRODUCT_LIST, wrap(async () => ProductRepo.getAll()));
  ipcMain.handle(IPC.PRODUCT_SEARCH, wrap(async (_e, q) => ProductRepo.search(q)));
  ipcMain.handle(IPC.PRODUCT_CREATE, wrap(async (_e, d) => ProductRepo.create(d)));
  ipcMain.handle(IPC.PRODUCT_UPDATE, wrap(async (_e, sku, f) => { ProductRepo.update(sku, f); return { success: true }; }));
  ipcMain.handle(IPC.PRODUCT_DELETE, wrap(async (_e, sku) => { ProductRepo.deleteBySku(sku); return { success: true }; }));

  // Platforms
  ipcMain.handle(IPC.PLATFORM_LIST, wrap(async () => {
    return PlatformRepo.getAll().map(r => ({ ...r, authConfigured: !!r.auth_data }));
  }));
  ipcMain.handle(IPC.PLATFORM_SAVE_AUTH, wrap(async (_e, code, d) => { PlatformRepo.updateAuth(code, JSON.stringify(d)); return { success: true }; }));
  ipcMain.handle(IPC.PLATFORM_TOGGLE_SYNC, wrap(async (_e, code, en) => { PlatformRepo.setSyncEnabled(code, en); return { success: true }; }));
  ipcMain.handle(IPC.PLATFORM_SYNC_NOW, wrap(async (_e, code) => runManualSync(code)));

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, wrap(async () => ({
    language: getStore().get('language', 'zh-CN'),
    autoLaunch: getStore().get('autoLaunch', false),
    minimizeToTray: getStore().get('minimizeToTray', true),
    aiProvider: getStore().get('aiProvider', 'deepseek'),
    aiApiKeyConfigured: !!(getSecureSetting('aiApiKey')),
    trackingApiKeyConfigured: !!(getSecureSetting('trackingApiKey')),
    backupPath: getStore().get('backupPath', ''),
  })));
  ipcMain.handle(IPC.SETTINGS_SET, wrap(async (_e, key, value) => {
    if (key === 'aiApiKey' || key === 'trackingApiKey') setSecureSetting(key, String(value));
    else getStore().set(key, value);
    return { success: true };
  }));
}
