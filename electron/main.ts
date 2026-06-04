import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { runMigrations, closeDb, initDatabase, saveDb } from './db/connection';
import { registerIpcHandlers } from './ipc-handlers';
import { startAllSyncJobs } from './sync/scheduler';
import { createTray, destroyTray } from './tray';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CrossFlow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL + '/src/index.html');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/src/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await runMigrations();
  await initDatabase();
  registerIpcHandlers();
  startAllSyncJobs();
  createWindow();
  createTray(mainWindow!);

  mainWindow!.on('close', (event) => {
    event.preventDefault();
    mainWindow!.hide();
  });
});

  // Schedule daily database backup
  setInterval(() => {
    try {
      const Store = require('electron-store');
      const store = new Store({ encryptionKey: 'crossflow-settings' });
      const backupPath = store.get('backupPath', '');
      if (backupPath) {
        const fs = require('fs');
        const path = require('path');
        const srcPath = path.join(app.getPath('userData'), 'crossflow.db');
        const date = new Date().toISOString().slice(0, 10);
        const destPath = path.join(backupPath, `crossflow-backup-${date}.db`);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Database backup saved to ${destPath}`);
        }
      }
    } catch (err) {
      console.error('Database backup failed:', err);
    }
  }, 86400000); // Every 24 hours

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  destroyTray();
  closeDb();
});
