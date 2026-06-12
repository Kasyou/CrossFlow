import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runMigrations, closeDb, initDatabase, getDb } from './db/connection';
import { getStore } from './store';
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

  // Apply auto-launch setting
  try {
    const { getStore } = require('./store');
    const store = getStore();
    const autoLaunch = store.get('autoLaunch', false);
    app.setLoginItemSettings({ openAtLogin: autoLaunch as boolean });
  } catch { /* settings not yet available */ }

  mainWindow!.on('close', (event) => {
    event.preventDefault();
    mainWindow!.hide();
  });

  // Schedule daily database backup
  setInterval(async () => {
    try {
      const store = getStore();
      const backupPath = store.get('backupPath', '') as unknown as string;
      if (backupPath) {
        const database = await getDb();
        const data = database.export(); // In-memory snapshot, no I/O race
        const date = new Date().toISOString().slice(0, 10);
        const tmpPath = path.join(os.tmpdir(), `${Date.now()}-backup.tmp`);
        const destPath = path.join(backupPath, `crossflow-backup-${date}.db`);
        fs.writeFileSync(tmpPath, Buffer.from(data));
        fs.renameSync(tmpPath, destPath);
        console.log(`Database backup saved to ${destPath}`);
      }
    } catch (err) {
      console.error('Database backup failed:', err);
    }
  }, 86400000); // Every 24 hours
});

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
