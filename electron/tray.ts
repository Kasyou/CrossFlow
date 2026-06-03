import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../resources/icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 CrossFlow', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '手动同步全部平台', click: () => { mainWindow.webContents.send('tray:sync-all'); } },
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

export function destroyTray(): void {
  if (tray) { tray.destroy(); tray = null; }
}
