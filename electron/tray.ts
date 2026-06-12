import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;
let _mainWindow: BrowserWindow | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow;
  const icon = nativeImage.createFromPath(path.join(__dirname, '../resources/icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 CrossFlow', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: '手动同步全部平台',
      click: () => { triggerSyncAll(); },
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);

  tray.setToolTip('CrossFlow - 跨境电商工作流');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

async function triggerSyncAll(): Promise<void> {
  try {
    const { PlatformRepo } = require('./db/repositories/platform-repo');
    const { runManualSync } = require('./sync/scheduler');
    const platforms = PlatformRepo.getAll().filter((p: any) => p.sync_enabled);
    let total = 0;
    for (const p of platforms) {
      const result = await runManualSync(p.code);
      total += result.records;
    }
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('tray:sync-done', { total, platforms: platforms.length });
    }
  } catch (err: any) {
    console.error('Tray sync-all failed:', err.message);
  }
}

export function destroyTray(): void {
  if (tray) { tray.destroy(); tray = null; }
  _mainWindow = null;
}
