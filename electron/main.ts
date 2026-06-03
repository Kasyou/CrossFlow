import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { runMigrations, closeDb, initDatabase } from './db/connection';
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
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
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
