# CrossFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CrossFlow, an Electron+React desktop app for Chinese cross-border e-commerce SMEs to manage orders and inventory across Amazon, TikTok Shop, Temu, and Shopee/Lazada.

**Architecture:** Monolithic Electron app. Main process handles platform API sync, SQLite storage, and AI calls. Renderer process (React+TypeScript) provides the UI via Ant Design 5. IPC bridges the two. Three V1 modules: Order Management, Inventory Management, Business Dashboard.

**Tech Stack:** Electron 28+, React 18, TypeScript, SQLite (better-sqlite3), Zustand, Ant Design 5, ECharts, node-cron, electron-builder

---

## File Structure Map

```
CrossFlow/
├── electron/
│   ├── main.ts                    # App entry, BrowserWindow, lifecycle
│   ├── preload.ts                 # contextBridge API for renderer
│   ├── tray.ts                    # System tray icon & menu
│   ├── ipc-handlers.ts            # All IPC handler registrations
│   ├── db/
│   │   ├── connection.ts          # SQLite init, WAL mode, migrations runner
│   │   ├── migrations/
│   │   │   └── 001_initial.ts     # Create all 7 tables
│   │   └── repositories/
│   │       ├── platform-repo.ts
│   │       ├── warehouse-repo.ts
│   │       ├── product-repo.ts
│   │       ├── order-repo.ts
│   │       ├── inventory-repo.ts
│   │       └── sync-log-repo.ts
│   ├── sync/
│   │   ├── scheduler.ts           # node-cron scheduler, retry logic
│   │   ├── amazon.ts              # SP-API connector
│   │   ├── shopee.ts              # Shopee Open Platform connector
│   │   ├── tiktok.ts              # TikTok cookie-based + Excel fallback
│   │   └── temu.ts                # Temu Excel parser
│   └── ai/
│       ├── adapter.ts             # Multi-provider AI adapter
│       └── prompts.ts             # Prompt templates
├── src/
│   ├── main.tsx                   # React entry
│   ├── App.tsx                    # Router + layout shell
│   ├── types/
│   │   ├── platform.ts
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── inventory.ts
│   │   └── dashboard.ts
│   ├── shared/
│   │   └── ipc-channels.ts        # IPC channel name constants
│   ├── pages/
│   │   ├── Orders/index.tsx
│   │   ├── Inventory/index.tsx
│   │   ├── Dashboard/index.tsx
│   │   ├── Settings/index.tsx
│   │   └── Onboarding/index.tsx
│   ├── components/
│   │   ├── order/
│   │   │   ├── OrderTable.tsx
│   │   │   └── OrderStatusTag.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryTable.tsx
│   │   │   ├── StockAlert.tsx
│   │   │   └── WarehouseCard.tsx
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── SalesChart.tsx
│   │   │   ├── PlatformPie.tsx
│   │   │   └── StockAlertList.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── shared/
│   │       └── ImportExcel.tsx
│   ├── stores/
│   │   ├── order-store.ts
│   │   ├── inventory-store.ts
│   │   ├── dashboard-store.ts
│   │   └── settings-store.ts
│   └── hooks/
│       ├── useIpc.ts
│       └── usePolling.ts
├── resources/
│   └── icon.png
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── vite.config.ts
└── README.md
```

**Boundary rules:**
- `src/types/` — pure TypeScript interfaces, no logic, importable by both main and renderer
- `src/shared/` — constants shared across processes
- `electron/` — main process only, Node.js APIs allowed
- `src/` (excluding shared/types) — renderer only, browser APIs only
- Communication: renderer calls `window.electronAPI.*` (defined in preload.ts); main responds via IPC handlers

---

## Phase 1: Project Scaffold

### Task 1.1: Initialize project with Electron + Vite + React + TypeScript

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `electron-builder.yml`
- Create: `src/main.tsx`
- Create: `src/index.html`
- Create: `resources/icon.png`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "crossflow",
  "version": "0.1.0",
  "description": "轻量级跨境电商工作流桌面端",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "antd": "^5.20.0",
    "@ant-design/icons": "^5.4.0",
    "zustand": "^4.5.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.2",
    "better-sqlite3": "^11.0.0",
    "node-cron": "^3.0.3",
    "electron-store": "^8.2.0",
    "uuid": "^10.0.0",
    "xlsx": "^0.18.5",
    "openai": "^4.52.0"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-builder": "^24.13.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node-cron": "^3.0.0",
    "@types/uuid": "^10.0.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.45.0",
    "eslint": "^8.57.0"
  },
  "build": {
    "appId": "com.crossflow.app",
    "productName": "CrossFlow",
    "directories": { "output": "release" },
    "win": { "target": "nsis", "icon": "resources/icon.png" },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true },
    "files": ["dist/**/*", "dist-electron/**/*"]
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@electron/*": ["electron/*"]
    }
  },
  "include": ["src/**/*", "electron/**/*"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      { entry: 'electron/main.ts' },
      { entry: 'electron/preload.ts', onstart(args) { args.reload(); } },
    ]),
    renderer(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 4: Create src/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CrossFlow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Install dependencies**

```bash
cd d:/WORKS/ClaudeCode/WorkflowProject/CrossBorderWorkflow && npm install
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Electron + Vite + React + TS project"
```

---

### Task 1.2: Create Electron main process entry

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Create electron/main.ts**

```typescript
import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 2: Create electron/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

- [ ] **Step 3: Verify dev starts**

```bash
npm run dev
```
Expected: Electron window opens showing blank React page.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts && git commit -m "feat: add Electron main process and preload bridge"
```

---

## Phase 2: Database Layer

### Task 2.1: SQLite connection and migration runner

**Files:**
- Create: `electron/db/connection.ts`
- Create: `electron/db/migrations/001_initial.ts`

- [ ] **Step 1: Create electron/db/connection.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'crossflow.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function runMigrations(): void {
  const database = getDb();
  const migrations = loadMigrations();
  for (const migration of migrations) {
    database.exec(migration);
  }
}

function loadMigrations(): string[] {
  return [require('./migrations/001_initial').default];
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 2: Create electron/db/migrations/001_initial.ts**

```typescript
const migration = `
CREATE TABLE IF NOT EXISTS platform (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  auth_data TEXT,
  sync_enabled INTEGER DEFAULT 1,
  sync_interval INTEGER DEFAULT 900
);

CREATE TABLE IF NOT EXISTS warehouse (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('domestic', 'fba', 'overseas')),
  country TEXT,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  category TEXT,
  cost_price REAL DEFAULT 0,
  weight_kg REAL DEFAULT 0,
  safety_stock INTEGER DEFAULT 10,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_platform (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  platform_id TEXT REFERENCES platform(id) ON DELETE CASCADE,
  platform_sku TEXT,
  platform_pid TEXT,
  selling_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'deleted')),
  UNIQUE(product_id, platform_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouse(id) ON DELETE CASCADE,
  available INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouse(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK(change_type IN ('order_reserve','order_release','restock','adjust','return')),
  quantity INTEGER NOT NULL,
  available_after INTEGER,
  reserved_after INTEGER,
  reference_id TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "order" (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  platform_order_id TEXT NOT NULL,
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  total_amount REAL DEFAULT 0,
  buyer_name TEXT,
  shipping_address TEXT,
  logistics_provider TEXT,
  tracking_number TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','matched','shipped','delivered','refunding','refunded','cancelled')),
  platform_status TEXT,
  order_time TEXT,
  shipped_time TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform_id, platform_order_id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  sync_type TEXT CHECK(sync_type IN ('order','inventory','product')),
  status TEXT CHECK(status IN ('success','partial','failed')),
  message TEXT,
  records_count INTEGER DEFAULT 0,
  started_at TEXT,
  finished_at TEXT
);
`;

export default migration;
```

- [ ] **Step 3: Integrate into main.ts**

Add to `electron/main.ts`, after `app.whenReady()`:

```typescript
import { runMigrations, closeDb } from './db/connection';

app.whenReady().then(() => {
  runMigrations();
  createWindow();
});

app.on('before-quit', () => {
  closeDb();
});
```

- [ ] **Step 4: Verify**

```bash
npx tsx -e "import { runMigrations, getDb } from './electron/db/connection'; runMigrations(); const db = getDb(); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"
```
Expected: Lists all 7 table names.

- [ ] **Step 5: Commit**

```bash
git add electron/db/ && git commit -m "feat: add SQLite connection, migrations, and 7-table schema"
```

---

### Task 2.2: Repository layer — Platform, Warehouse, Product

**Files:**
- Create: `electron/db/repositories/platform-repo.ts`
- Create: `electron/db/repositories/warehouse-repo.ts`
- Create: `electron/db/repositories/product-repo.ts`

- [ ] **Step 1: Create electron/db/repositories/platform-repo.ts**

```typescript
import { getDb } from '../connection';

export interface PlatformRow {
  id: string;
  code: string;
  name: string;
  auth_data: string | null;
  sync_enabled: number;
  sync_interval: number;
}

export const PlatformRepo = {
  getAll(): PlatformRow[] {
    return getDb().prepare('SELECT * FROM platform').all() as PlatformRow[];
  },

  getByCode(code: string): PlatformRow | undefined {
    return getDb().prepare('SELECT * FROM platform WHERE code = ?').get(code) as PlatformRow | undefined;
  },

  upsert(id: string, code: string, name: string): void {
    getDb().prepare(
      'INSERT INTO platform (id, code, name) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name'
    ).run(id, code, name);
  },

  updateAuth(code: string, authData: string): void {
    getDb().prepare('UPDATE platform SET auth_data = ? WHERE code = ?').run(authData, code);
  },

  setSyncEnabled(code: string, enabled: boolean): void {
    getDb().prepare('UPDATE platform SET sync_enabled = ? WHERE code = ?').run(enabled ? 1 : 0, code);
  },

  setSyncInterval(code: string, intervalSeconds: number): void {
    getDb().prepare('UPDATE platform SET sync_interval = ? WHERE code = ?').run(intervalSeconds, code);
  },

  deleteByCode(code: string): void {
    getDb().prepare('DELETE FROM platform WHERE code = ?').run(code);
  },
};
```

- [ ] **Step 2: Create electron/db/repositories/warehouse-repo.ts**

```typescript
import { getDb } from '../connection';
import { v4 as uuid } from 'uuid';

export interface WarehouseRow {
  id: string;
  name: string;
  type: 'domestic' | 'fba' | 'overseas';
  country: string | null;
  is_default: number;
}

export const WarehouseRepo = {
  getAll(): WarehouseRow[] {
    return getDb().prepare('SELECT * FROM warehouse ORDER BY is_default DESC').all() as WarehouseRow[];
  },

  getById(id: string): WarehouseRow | undefined {
    return getDb().prepare('SELECT * FROM warehouse WHERE id = ?').get(id) as WarehouseRow | undefined;
  },

  create(name: string, type: string, country?: string): WarehouseRow {
    const id = uuid();
    getDb().prepare('INSERT INTO warehouse (id, name, type, country) VALUES (?, ?, ?, ?)').run(id, name, type, country || null);
    return this.getById(id)!;
  },

  update(id: string, fields: Partial<Pick<WarehouseRow, 'name' | 'country'>>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.country !== undefined) { sets.push('country = ?'); vals.push(fields.country); }
    if (sets.length === 0) return;
    vals.push(id);
    getDb().prepare(`UPDATE warehouse SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },

  setDefault(id: string): void {
    const db = getDb();
    db.prepare('UPDATE warehouse SET is_default = 0').run();
    db.prepare('UPDATE warehouse SET is_default = 1 WHERE id = ?').run(id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM warehouse WHERE id = ?').run(id);
  },
};
```

- [ ] **Step 3: Create electron/db/repositories/product-repo.ts**

```typescript
import { getDb } from '../connection';
import { v4 as uuid } from 'uuid';

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
  category: string | null;
  cost_price: number;
  weight_kg: number;
  safety_stock: number;
  created_at: string;
}

export const ProductRepo = {
  getAll(): ProductRow[] {
    return getDb().prepare('SELECT * FROM product ORDER BY created_at DESC').all() as ProductRow[];
  },

  getBySku(sku: string): ProductRow | undefined {
    return getDb().prepare('SELECT * FROM product WHERE sku = ?').get(sku) as ProductRow | undefined;
  },

  getById(id: string): ProductRow | undefined {
    return getDb().prepare('SELECT * FROM product WHERE id = ?').get(id) as ProductRow | undefined;
  },

  create(data: { sku: string; name: string; name_en?: string; category?: string; cost_price?: number; weight_kg?: number; safety_stock?: number }): ProductRow {
    const id = uuid();
    getDb().prepare(
      `INSERT INTO product (id, sku, name, name_en, category, cost_price, weight_kg, safety_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.sku, data.name, data.name_en || null, data.category || null, data.cost_price ?? 0, data.weight_kg ?? 0, data.safety_stock ?? 10);
    return this.getById(id)!;
  },

  update(sku: string, fields: Partial<Pick<ProductRow, 'name' | 'name_en' | 'category' | 'cost_price' | 'weight_kg' | 'safety_stock'>>): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${key} = ?`); vals.push(val); }
    }
    if (sets.length === 0) return;
    vals.push(sku);
    getDb().prepare(`UPDATE product SET ${sets.join(', ')} WHERE sku = ?`).run(...vals);
  },

  deleteBySku(sku: string): void {
    getDb().prepare('DELETE FROM product WHERE sku = ?').run(sku);
  },

  search(query: string): ProductRow[] {
    return getDb().prepare('SELECT * FROM product WHERE sku LIKE ? OR name LIKE ? ORDER BY created_at DESC')
      .all(`%${query}%`, `%${query}%`) as ProductRow[];
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add electron/db/repositories/ && git commit -m "feat: add platform, warehouse, product repositories"
```

---

### Task 2.3: Repository layer — Order, Inventory, SyncLog

**Files:**
- Create: `electron/db/repositories/order-repo.ts`
- Create: `electron/db/repositories/inventory-repo.ts`
- Create: `electron/db/repositories/sync-log-repo.ts`

- [ ] **Step 1: Create electron/db/repositories/order-repo.ts**

```typescript
import { getDb } from '../connection';
import { v4 as uuid } from 'uuid';

export interface OrderRow {
  id: string;
  platform_id: string;
  platform_order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  logistics_provider: string | null;
  tracking_number: string | null;
  status: 'pending' | 'matched' | 'shipped' | 'delivered' | 'refunding' | 'refunded' | 'cancelled';
  platform_status: string | null;
  order_time: string | null;
  shipped_time: string | null;
  synced_at: string;
}

export interface OrderFilter {
  status?: string;
  platform_id?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export const OrderRepo = {
  list(filter: OrderFilter = {}): { rows: OrderRow[]; total: number } {
    const conditions: string[] = [];
    const vals: unknown[] = [];

    if (filter.status) { conditions.push('o.status = ?'); vals.push(filter.status); }
    if (filter.platform_id) { conditions.push('o.platform_id = ?'); vals.push(filter.platform_id); }
    if (filter.sku) { conditions.push('o.sku LIKE ?'); vals.push(`%${filter.sku}%`); }
    if (filter.dateFrom) { conditions.push('o.order_time >= ?'); vals.push(filter.dateFrom); }
    if (filter.dateTo) { conditions.push('o.order_time <= ?'); vals.push(filter.dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const db = getDb();
    const total = (db.prepare(`SELECT COUNT(*) as count FROM "order" o ${where}`).get(...vals) as { count: number }).count;
    const rows = db.prepare(
      `SELECT o.*, p.name as platform_name FROM "order" o LEFT JOIN platform p ON o.platform_id = p.id ${where} ORDER BY o.order_time DESC LIMIT ? OFFSET ?`
    ).all(...vals, limit, offset) as (OrderRow & { platform_name: string })[];

    return { rows, total };
  },

  getById(id: string): (OrderRow & { platform_name: string }) | undefined {
    return getDb().prepare(
      `SELECT o.*, p.name as platform_name FROM "order" o LEFT JOIN platform p ON o.platform_id = p.id WHERE o.id = ?`
    ).get(id) as (OrderRow & { platform_name: string }) | undefined;
  },

  upsert(data: Omit<OrderRow, 'id' | 'synced_at'> & { id?: string }): OrderRow {
    const id = data.id || uuid();
    getDb().prepare(
      `INSERT INTO "order" (id, platform_id, platform_order_id, product_id, sku, quantity, unit_price, currency, total_amount, buyer_name, shipping_address, logistics_provider, tracking_number, status, platform_status, order_time, shipped_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(platform_id, platform_order_id) DO UPDATE SET
         status = excluded.status, platform_status = excluded.platform_status, tracking_number = excluded.tracking_number, shipped_time = excluded.shipped_time, synced_at = datetime('now')`
    ).run(id, data.platform_id, data.platform_order_id, data.product_id, data.sku, data.quantity, data.unit_price, data.currency, data.total_amount, data.buyer_name, data.shipping_address, data.logistics_provider, data.tracking_number, data.status, data.platform_status, data.order_time, data.shipped_time);
    return this.getById(id)!;
  },

  updateStatus(id: string, status: string, trackingNumber?: string): void {
    if (trackingNumber) {
      getDb().prepare(`UPDATE "order" SET status = ?, tracking_number = ?, shipped_time = datetime('now') WHERE id = ?`).run(status, trackingNumber, id);
    } else {
      getDb().prepare(`UPDATE "order" SET status = ? WHERE id = ?`).run(status, id);
    }
  },

  batchUpdateStatus(ids: string[], status: string): void {
    const stmt = getDb().prepare(`UPDATE "order" SET status = ? WHERE id = ?`);
    const tx = getDb().transaction((orderIds: string[]) => {
      for (const id of orderIds) stmt.run(status, id);
    });
    tx(ids);
  },

  getPendingCount(): number {
    return (getDb().prepare(`SELECT COUNT(*) as count FROM "order" WHERE status IN ('pending','matched')`).get() as { count: number }).count;
  },

  getTodayStats(): { revenue: number; orderCount: number } {
    const row = getDb().prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount FROM "order" WHERE date(synced_at) = date('now')`
    ).get() as { revenue: number; orderCount: number };
    return row;
  },
};
```

- [ ] **Step 2: Create electron/db/repositories/inventory-repo.ts**

```typescript
import { getDb } from '../connection';
import { v4 as uuid } from 'uuid';

export interface InventoryRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  available: number;
  reserved: number;
  in_transit: number;
  updated_at: string;
}

export interface InventoryLogRow {
  id: string;
  product_id: string;
  warehouse_id: string;
  change_type: 'order_reserve' | 'order_release' | 'restock' | 'adjust' | 'return';
  quantity: number;
  available_after: number;
  reserved_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export const InventoryRepo = {
  getByProductWarehouse(productId: string, warehouseId: string): InventoryRow | undefined {
    return getDb().prepare('SELECT * FROM inventory WHERE product_id = ? AND warehouse_id = ?').get(productId, warehouseId) as InventoryRow | undefined;
  },

  getAllWithDetails(): (InventoryRow & { sku: string; product_name: string; warehouse_name: string; warehouse_type: string })[] {
    return getDb().prepare(
      `SELECT i.*, p.sku, p.name as product_name, p.safety_stock, w.name as warehouse_name, w.type as warehouse_type
       FROM inventory i JOIN product p ON i.product_id = p.id JOIN warehouse w ON i.warehouse_id = w.id
       ORDER BY (i.available + i.reserved + i.in_transit) ASC`
    ).all() as any;
  },

  getLowStock(): (InventoryRow & { sku: string; product_name: string; safety_stock: number; warehouse_name: string })[] {
    return getDb().prepare(
      `SELECT i.*, p.sku, p.name as product_name, p.safety_stock, w.name as warehouse_name
       FROM inventory i JOIN product p ON i.product_id = p.id JOIN warehouse w ON i.warehouse_id = w.id
       WHERE i.available < p.safety_stock ORDER BY (i.available - p.safety_stock) ASC LIMIT 10`
    ).all() as any;
  },

  getTotalByProduct(productId: string): { totalAvailable: number; totalReserved: number; totalInTransit: number } {
    return getDb().prepare(
      'SELECT COALESCE(SUM(available),0) as totalAvailable, COALESCE(SUM(reserved),0) as totalReserved, COALESCE(SUM(in_transit),0) as totalInTransit FROM inventory WHERE product_id = ?'
    ).get(productId) as any;
  },

  ensure(productId: string, warehouseId: string): InventoryRow {
    const existing = this.getByProductWarehouse(productId, warehouseId);
    if (existing) return existing;
    const id = uuid();
    getDb().prepare('INSERT INTO inventory (id, product_id, warehouse_id) VALUES (?, ?, ?)').run(id, productId, warehouseId);
    return this.getByProductWarehouse(productId, warehouseId)!;
  },

  reserve(productId: string, warehouseId: string, quantity: number, orderId: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDb();
    const tx = db.transaction(() => {
      const newAvailable = inv.available - quantity;
      const newReserved = inv.reserved + quantity;
      db.prepare('UPDATE inventory SET available = ?, reserved = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newReserved, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'order_reserve', -quantity, newAvailable, newReserved, orderId);
    });
    tx();
  },

  release(productId: string, warehouseId: string, quantity: number, orderId: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDb();
    const tx = db.transaction(() => {
      const newAvailable = inv.available + quantity;
      const newReserved = Math.max(0, inv.reserved - quantity);
      db.prepare('UPDATE inventory SET available = ?, reserved = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newReserved, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'order_release', quantity, newAvailable, newReserved, orderId);
    });
    tx();
  },

  restock(productId: string, warehouseId: string, quantity: number, note?: string): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDb();
    const tx = db.transaction(() => {
      const newInTransit = inv.in_transit + quantity;
      db.prepare('UPDATE inventory SET in_transit = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newInTransit, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'restock', quantity, inv.available, inv.reserved, note || null);
    });
    tx();
  },

  receiveRestock(productId: string, warehouseId: string, quantity: number): void {
    const inv = this.ensure(productId, warehouseId);
    const db = getDb();
    const tx = db.transaction(() => {
      const newAvailable = inv.available + quantity;
      const newInTransit = Math.max(0, inv.in_transit - quantity);
      db.prepare('UPDATE inventory SET available = ?, in_transit = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newAvailable, newInTransit, inv.id);
      db.prepare(
        'INSERT INTO inventory_log (id, product_id, warehouse_id, change_type, quantity, available_after, reserved_after) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), productId, warehouseId, 'restock', quantity, newAvailable, inv.reserved);
    });
    tx();
  },

  getLogs(productId: string, limit = 50): InventoryLogRow[] {
    return getDb().prepare('SELECT * FROM inventory_log WHERE product_id = ? ORDER BY created_at DESC LIMIT ?').all(productId, limit) as InventoryLogRow[];
  },
};
```

- [ ] **Step 3: Create electron/db/repositories/sync-log-repo.ts**

```typescript
import { getDb } from '../connection';
import { v4 as uuid } from 'uuid';

export interface SyncLogRow {
  id: string;
  platform_id: string;
  sync_type: 'order' | 'inventory' | 'product';
  status: 'success' | 'partial' | 'failed';
  message: string | null;
  records_count: number;
  started_at: string;
  finished_at: string;
}

export const SyncLogRepo = {
  create(platformId: string, syncType: string): string {
    const id = uuid();
    getDb().prepare(
      'INSERT INTO sync_log (id, platform_id, sync_type, status, started_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(id, platformId, syncType, 'success');
    return id;
  },

  finish(id: string, status: string, message: string | null, recordsCount: number): void {
    getDb().prepare(
      'UPDATE sync_log SET status = ?, message = ?, records_count = ?, finished_at = datetime(\'now\') WHERE id = ?'
    ).run(status, message, recordsCount, id);
  },

  getRecent(limit = 20): SyncLogRow[] {
    return getDb().prepare('SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?').all(limit) as SyncLogRow[];
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add electron/db/repositories/ && git commit -m "feat: add order, inventory, sync-log repositories"
```

---

## Phase 3: IPC Bridge & Shared Types

### Task 3.1: Shared type definitions

**Files:**
- Create: `src/types/platform.ts`
- Create: `src/types/product.ts`
- Create: `src/types/order.ts`
- Create: `src/types/inventory.ts`
- Create: `src/types/dashboard.ts`

- [ ] **Step 1: Create src/types/platform.ts**

```typescript
export interface PlatformConfig {
  id: string;
  code: 'amazon' | 'tiktok' | 'temu' | 'shopee' | 'lazada';
  name: string;
  authConfigured: boolean;
  syncEnabled: boolean;
  syncInterval: number;
}

export type PlatformCode = PlatformConfig['code'];
```

- [ ] **Step 2: Create src/types/product.ts**

```typescript
export interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn: string | null;
  imageUrl: string | null;
  category: string | null;
  costPrice: number;
  weightKg: number;
  safetyStock: number;
  createdAt: string;
}

export interface ProductPlatform {
  id: string;
  productId: string;
  platformId: string;
  platformSku: string | null;
  platformPid: string | null;
  sellingPrice: number;
  currency: string;
  status: 'active' | 'paused' | 'deleted';
}
```

- [ ] **Step 3: Create src/types/order.ts**

```typescript
export type OrderStatus = 'pending' | 'matched' | 'shipped' | 'delivered' | 'refunding' | 'refunded' | 'cancelled';

export interface Order {
  id: string;
  platform_id: string;
  platform_name: string;
  platform_order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  logistics_provider: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  platform_status: string | null;
  order_time: string | null;
  shipped_time: string | null;
  synced_at: string;
}

export interface OrderFilter {
  status?: string;
  platformId?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 4: Create src/types/inventory.ts**

```typescript
export interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  sku: string;
  product_name: string;
  warehouse_name: string;
  warehouse_type: 'domestic' | 'fba' | 'overseas';
  available: number;
  reserved: number;
  in_transit: number;
  safety_stock: number;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: 'domestic' | 'fba' | 'overseas';
  country: string | null;
  isDefault: boolean;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  warehouse_id: string;
  change_type: 'order_reserve' | 'order_release' | 'restock' | 'adjust' | 'return';
  quantity: number;
  available_after: number;
  reserved_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}
```

- [ ] **Step 5: Create src/types/dashboard.ts**

```typescript
export interface DashboardMetrics {
  todayRevenue: number;
  todayOrderCount: number;
  yesterdayRevenue: number;
  yesterdayOrderCount: number;
  avgInventoryTurnoverDays: number;
  totalSkuCount: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
  platformId: string;
  platformName: string;
}

export interface PlatformSalesShare {
  platformId: string;
  platformName: string;
  revenue: number;
  percentage: number;
}

export interface SkuProfitRank {
  sku: string;
  productName: string;
  revenue: number;
  orderCount: number;
  estimatedProfit: number;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/types/ && git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3.2: IPC channels and handler registration

**Files:**
- Create: `src/shared/ipc-channels.ts`
- Create: `electron/ipc-handlers.ts`
- Modify: `electron/main.ts` (register handlers)

- [ ] **Step 1: Create src/shared/ipc-channels.ts**

```typescript
export const IPC = {
  // Order
  ORDERS_LIST: 'orders:list',
  ORDERS_GET: 'orders:get',
  ORDERS_UPDATE_STATUS: 'orders:updateStatus',
  ORDERS_BATCH_SHIP: 'orders:batchShip',
  ORDERS_PENDING_COUNT: 'orders:pendingCount',
  ORDERS_IMPORT_EXCEL: 'orders:importExcel',

  // Inventory
  INVENTORY_LIST: 'inventory:list',
  INVENTORY_LOW_STOCK: 'inventory:lowStock',
  INVENTORY_RESTOCK: 'inventory:restock',
  INVENTORY_RECEIVE: 'inventory:receive',
  INVENTORY_LOGS: 'inventory:logs',
  INVENTORY_PAUSE_SKU: 'inventory:pauseSku',

  // Warehouse
  WAREHOUSE_LIST: 'warehouse:list',
  WAREHOUSE_CREATE: 'warehouse:create',
  WAREHOUSE_UPDATE: 'warehouse:update',
  WAREHOUSE_DELETE: 'warehouse:delete',
  WAREHOUSE_SET_DEFAULT: 'warehouse:setDefault',

  // Product
  PRODUCT_LIST: 'product:list',
  PRODUCT_SEARCH: 'product:search',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',

  // Platform
  PLATFORM_LIST: 'platform:list',
  PLATFORM_SAVE_AUTH: 'platform:saveAuth',
  PLATFORM_TOGGLE_SYNC: 'platform:toggleSync',
  PLATFORM_SYNC_NOW: 'platform:syncNow',

  // Dashboard
  DASHBOARD_METRICS: 'dashboard:metrics',
  DASHBOARD_SALES_TREND: 'dashboard:salesTrend',
  DASHBOARD_PLATFORM_SHARE: 'dashboard:platformShare',
  DASHBOARD_SKU_PROFIT: 'dashboard:skuProfit',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const;
```

- [ ] **Step 2: Create electron/ipc-handlers.ts** with stubs for all channels

```typescript
import { ipcMain } from 'electron';
import { IPC } from '../src/shared/ipc-channels';

export function registerIpcHandlers(): void {
  // ---- Orders ----
  ipcMain.handle(IPC.ORDERS_LIST, async (_e, filter) => {
    const { OrderRepo } = require('./db/repositories/order-repo');
    const result = OrderRepo.list(filter || {});
    return { rows: result.rows, total: result.total };
  });

  ipcMain.handle(IPC.ORDERS_GET, async (_e, id) => {
    const { OrderRepo } = require('./db/repositories/order-repo');
    return OrderRepo.getById(id);
  });

  ipcMain.handle(IPC.ORDERS_UPDATE_STATUS, async (_e, id, status, trackingNumber) => {
    const { OrderRepo } = require('./db/repositories/order-repo');
    OrderRepo.updateStatus(id, status, trackingNumber);
  });

  ipcMain.handle(IPC.ORDERS_BATCH_SHIP, async (_e, ids) => {
    const { OrderRepo } = require('./db/repositories/order-repo');
    OrderRepo.batchUpdateStatus(ids, 'shipped');
  });

  ipcMain.handle(IPC.ORDERS_PENDING_COUNT, async () => {
    const { OrderRepo } = require('./db/repositories/order-repo');
    return OrderRepo.getPendingCount();
  });

  ipcMain.handle(IPC.ORDERS_IMPORT_EXCEL, async (_e, filePath, platformCode) => {
    const { importTemuExcel } = require('./sync/temu');
    return importTemuExcel(filePath);
  });

  // ---- Inventory ----
  ipcMain.handle(IPC.INVENTORY_LIST, async () => {
    const { InventoryRepo } = require('./db/repositories/inventory-repo');
    return InventoryRepo.getAllWithDetails();
  });

  ipcMain.handle(IPC.INVENTORY_LOW_STOCK, async () => {
    const { InventoryRepo } = require('./db/repositories/inventory-repo');
    return InventoryRepo.getLowStock();
  });

  ipcMain.handle(IPC.INVENTORY_RESTOCK, async (_e, productId, warehouseId, quantity, note) => {
    const { InventoryRepo } = require('./db/repositories/inventory-repo');
    InventoryRepo.restock(productId, warehouseId, quantity, note);
  });

  ipcMain.handle(IPC.INVENTORY_RECEIVE, async (_e, productId, warehouseId, quantity) => {
    const { InventoryRepo } = require('./db/repositories/inventory-repo');
    InventoryRepo.receiveRestock(productId, warehouseId, quantity);
  });

  ipcMain.handle(IPC.INVENTORY_LOGS, async (_e, productId, limit) => {
    const { InventoryRepo } = require('./db/repositories/inventory-repo');
    return InventoryRepo.getLogs(productId, limit || 50);
  });

  // ---- Warehouse ----
  ipcMain.handle(IPC.WAREHOUSE_LIST, async () => {
    const { WarehouseRepo } = require('./db/repositories/warehouse-repo');
    return WarehouseRepo.getAll();
  });

  ipcMain.handle(IPC.WAREHOUSE_CREATE, async (_e, name, type, country) => {
    const { WarehouseRepo } = require('./db/repositories/warehouse-repo');
    return WarehouseRepo.create(name, type, country);
  });

  ipcMain.handle(IPC.WAREHOUSE_UPDATE, async (_e, id, fields) => {
    const { WarehouseRepo } = require('./db/repositories/warehouse-repo');
    WarehouseRepo.update(id, fields);
  });

  ipcMain.handle(IPC.WAREHOUSE_DELETE, async (_e, id) => {
    const { WarehouseRepo } = require('./db/repositories/warehouse-repo');
    WarehouseRepo.delete(id);
  });

  ipcMain.handle(IPC.WAREHOUSE_SET_DEFAULT, async (_e, id) => {
    const { WarehouseRepo } = require('./db/repositories/warehouse-repo');
    WarehouseRepo.setDefault(id);
  });

  // ---- Product ----
  ipcMain.handle(IPC.PRODUCT_LIST, async () => {
    const { ProductRepo } = require('./db/repositories/product-repo');
    return ProductRepo.getAll();
  });

  ipcMain.handle(IPC.PRODUCT_SEARCH, async (_e, query) => {
    const { ProductRepo } = require('./db/repositories/product-repo');
    return ProductRepo.search(query);
  });

  ipcMain.handle(IPC.PRODUCT_CREATE, async (_e, data) => {
    const { ProductRepo } = require('./db/repositories/product-repo');
    return ProductRepo.create(data);
  });

  ipcMain.handle(IPC.PRODUCT_UPDATE, async (_e, sku, fields) => {
    const { ProductRepo } = require('./db/repositories/product-repo');
    ProductRepo.update(sku, fields);
  });

  ipcMain.handle(IPC.PRODUCT_DELETE, async (_e, sku) => {
    const { ProductRepo } = require('./db/repositories/product-repo');
    ProductRepo.deleteBySku(sku);
  });

  // ---- Platform ----
  ipcMain.handle(IPC.PLATFORM_LIST, async () => {
    const { PlatformRepo } = require('./db/repositories/platform-repo');
    const rows = PlatformRepo.getAll();
    return rows.map(r => ({
      ...r,
      authConfigured: !!r.auth_data,
    }));
  });

  ipcMain.handle(IPC.PLATFORM_SAVE_AUTH, async (_e, code, authData) => {
    const { PlatformRepo } = require('./db/repositories/platform-repo');
    PlatformRepo.updateAuth(code, JSON.stringify(authData));
  });

  ipcMain.handle(IPC.PLATFORM_TOGGLE_SYNC, async (_e, code, enabled) => {
    const { PlatformRepo } = require('./db/repositories/platform-repo');
    PlatformRepo.setSyncEnabled(code, enabled);
  });

  ipcMain.handle(IPC.PLATFORM_SYNC_NOW, async (_e, code) => {
    const { runManualSync } = require('./sync/scheduler');
    return runManualSync(code);
  });

  // ---- Dashboard ----
  ipcMain.handle(IPC.DASHBOARD_METRICS, async () => {
    const { getDashboardMetrics } = require('./sync/scheduler');
    return getDashboardMetrics();
  });

  ipcMain.handle(IPC.DASHBOARD_SALES_TREND, async (_e, days) => {
    const { getDb } = require('./db/connection');
    const rows = getDb().prepare(
      `SELECT date(o.order_time) as date, COALESCE(SUM(o.total_amount),0) as revenue, COUNT(*) as orderCount, o.platform_id as platformId, p.name as platformName
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', ?) GROUP BY date(o.order_time), o.platform_id ORDER BY date(o.order_time)`
    ).all(`-${days || 30} days`);
    return rows;
  });

  ipcMain.handle(IPC.DASHBOARD_PLATFORM_SHARE, async () => {
    const { getDb } = require('./db/connection');
    const rows = getDb().prepare(
      `SELECT o.platform_id as platformId, p.name as platformName, COALESCE(SUM(o.total_amount),0) as revenue
       FROM "order" o JOIN platform p ON o.platform_id = p.id
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.platform_id ORDER BY revenue DESC`
    ).all() as any[];
    const total = rows.reduce((sum: number, r: any) => sum + r.revenue, 0);
    return rows.map((r: any) => ({ ...r, percentage: total > 0 ? Math.round((r.revenue / total) * 100) : 0 }));
  });

  ipcMain.handle(IPC.DASHBOARD_SKU_PROFIT, async () => {
    const { getDb } = require('./db/connection');
    return getDb().prepare(
      `SELECT o.sku, p.name as productName, COUNT(*) as orderCount, COALESCE(SUM(o.total_amount),0) as revenue,
              COALESCE(SUM(o.total_amount) - COUNT(*) * p.cost_price, 0) as estimatedProfit
       FROM "order" o JOIN product p ON o.sku = p.sku
       WHERE o.order_time >= date('now', '-30 days') GROUP BY o.sku ORDER BY estimatedProfit DESC LIMIT 20`
    ).all();
  });

  // ---- Settings ----
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    const Store = require('electron-store');
    const store = new Store({ encryptionKey: 'crossflow-settings' });
    return {
      language: store.get('language', 'zh-CN'),
      autoLaunch: store.get('autoLaunch', false),
      minimizeToTray: store.get('minimizeToTray', true),
      aiProvider: store.get('aiProvider', 'deepseek'),
      aiApiKey: store.get('aiApiKey', ''),
      backupPath: store.get('backupPath', ''),
    };
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, key, value) => {
    const Store = require('electron-store');
    const store = new Store({ encryptionKey: 'crossflow-settings' });
    store.set(key, value);
  });
}
```

- [ ] **Step 3: Register handlers in electron/main.ts**

Add after `app.whenReady()`:
```typescript
import { registerIpcHandlers } from './ipc-handlers';

app.whenReady().then(() => {
  runMigrations();
  registerIpcHandlers();
  createWindow();
});
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc-channels.ts electron/ipc-handlers.ts && git commit -m "feat: add IPC channels and handler registration for all modules"
```

---

## Phase 4: Platform Connectors

### Task 4.1: Sync scheduler with retry logic

**Files:**
- Create: `electron/sync/scheduler.ts`

- [ ] **Step 1: Create electron/sync/scheduler.ts**

```typescript
import cron from 'node-cron';
import { PlatformRepo } from '../db/repositories/platform-repo';
import { SyncLogRepo } from '../db/repositories/sync-log-repo';
import { OrderRepo } from '../db/repositories/order-repo';

const jobs = new Map<string, cron.ScheduledTask>();

export function startAllSyncJobs(): void {
  const platforms = PlatformRepo.getAll();
  for (const p of platforms) {
    if (p.sync_enabled) schedulePlatform(p.code);
  }
}

export function stopAllSyncJobs(): void {
  for (const [code, job] of jobs) {
    job.stop();
    jobs.delete(code);
  }
}

function schedulePlatform(code: string): void {
  stopPlatformJob(code);
  const platform = PlatformRepo.getByCode(code);
  if (!platform || !platform.sync_enabled) return;
  const intervalSeconds = platform.sync_interval || 900;
  const minutes = Math.max(1, Math.floor(intervalSeconds / 60));
  const cronExpr = `*/${minutes} * * * *`;

  const job = cron.schedule(cronExpr, () => {
    syncPlatform(code).catch(err => console.error(`Sync failed for ${code}:`, err));
  });
  jobs.set(code, job);
}

export function stopPlatformJob(code: string): void {
  const existing = jobs.get(code);
  if (existing) { existing.stop(); jobs.delete(code); }
}

export async function runManualSync(code: string): Promise<{ status: string; records: number; message: string }> {
  return syncPlatform(code);
}

async function syncPlatform(code: string): Promise<{ status: string; records: number; message: string }> {
  const platform = PlatformRepo.getByCode(code);
  if (!platform) return { status: 'failed', records: 0, message: 'Platform not found' };

  const logId = SyncLogRepo.create(platform.id, 'order');

  try {
    let result: { orders: any[]; message?: string };
    switch (code) {
      case 'amazon': result = await withRetry(() => require('./amazon').syncAmazonOrders(platform)); break;
      case 'shopee': result = await withRetry(() => require('./shopee').syncShopeeOrders(platform)); break;
      case 'tiktok': result = await withRetry(() => require('./tiktok').syncTikTokOrders(platform)); break;
      default: result = { orders: [], message: 'No API sync for this platform' };
    }

    let synced = 0;
    for (const order of result.orders) {
      OrderRepo.upsert({ ...order, platform_id: platform.id });
      synced++;
    }

    const status = synced > 0 ? 'success' : 'partial';
    SyncLogRepo.finish(logId, status, result.message || null, synced);
    return { status, records: synced, message: result.message || 'OK' };
  } catch (err: any) {
    SyncLogRepo.finish(logId, 'failed', err.message, 0);
    return { status: 'failed', records: 0, message: err.message };
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const delays = [60000, 300000, 900000]; // 1min, 5min, 15min
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delays[attempt] || 900000));
    }
  }
  throw new Error('unreachable');
}

export function getDashboardMetrics() {
  const today = OrderRepo.getTodayStats();
  const db = require('../db/connection').getDb();
  const yesterday = db.prepare(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orderCount FROM "order" WHERE date(synced_at) = date('now', '-1 day')`
  ).get() as { revenue: number; orderCount: number };

  const skuCount = (db.prepare('SELECT COUNT(*) as count FROM product').get() as { count: number }).count;

  return {
    todayRevenue: today.revenue,
    todayOrderCount: today.orderCount,
    yesterdayRevenue: yesterday.revenue,
    yesterdayOrderCount: yesterday.orderCount,
    avgInventoryTurnoverDays: 0, // V1.1
    totalSkuCount: skuCount,
  };
}
```

- [ ] **Step 2: Integrate into main.ts**

```typescript
import { startAllSyncJobs } from './sync/scheduler';

app.whenReady().then(() => {
  runMigrations();
  registerIpcHandlers();
  startAllSyncJobs();
  createWindow();
});
```

- [ ] **Step 3: Commit**

```bash
git add electron/sync/scheduler.ts && git commit -m "feat: add sync scheduler with cron, retry, and manual sync support"
```

---

### Task 4.2: Amazon SP-API connector (stub + real structure)

**Files:**
- Create: `electron/sync/amazon.ts`

- [ ] **Step 1: Create electron/sync/amazon.ts**

```typescript
import { PlatformRow } from '../db/repositories/platform-repo';

interface AmazonOrder {
  platform_order_id: string;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  status: string;
  platform_status: string;
  order_time: string;
}

export async function syncAmazonOrders(platform: PlatformRow): Promise<{ orders: AmazonOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.refreshToken || !auth.clientId || !auth.clientSecret) {
    return { orders: [], message: 'Amazon SP-API credentials not configured' };
  }

  const accessToken = await getAccessToken(auth);
  const orders = await fetchOrders(accessToken, auth.region || 'na');

  return { orders };
}

async function getAccessToken(auth: { refreshToken: string; clientId: string; clientSecret: string }): Promise<string> {
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    }),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`Amazon auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchOrders(accessToken: string, region: string): Promise<AmazonOrder[]> {
  const baseUrl = region === 'eu' ? 'https://sellingpartnerapi-eu.amazon.com' : 'https://sellingpartnerapi-na.amazon.com';
  const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${baseUrl}/orders/v0/orders?MarketplaceIds=ATVPDKIKX0DER&CreatedAfter=${createdAfter}&OrderStatuses=Unshipped&OrderStatuses=PartiallyShipped`, {
    headers: { 'x-amz-access-token': accessToken },
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`Amazon API error: ${JSON.stringify(data)}`);

  const orders = data.payload?.Orders || [];
  return orders.map((o: any) => ({
    platform_order_id: o.AmazonOrderId,
    sku: '', // requires separate order items API call
    quantity: o.NumberOfItemsUnshipped || 1,
    unit_price: o.OrderTotal?.Amount || 0,
    currency: o.OrderTotal?.CurrencyCode || 'USD',
    total_amount: o.OrderTotal?.Amount || 0,
    buyer_name: o.BuyerName || null,
    shipping_address: o.ShippingAddress ? JSON.stringify(o.ShippingAddress) : null,
    status: mapOrderStatus(o.OrderStatus),
    platform_status: o.OrderStatus,
    order_time: o.PurchaseDate,
  }));
}

function mapOrderStatus(amazonStatus: string): string {
  const map: Record<string, string> = {
    'Unshipped': 'pending',
    'PartiallyShipped': 'matched',
    'Shipped': 'shipped',
    'Canceled': 'cancelled',
  };
  return map[amazonStatus] || 'pending';
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/sync/amazon.ts && git commit -m "feat: add Amazon SP-API connector with OAuth and order fetching"
```

---

### Task 4.3: Shopee connector + TikTok stub + Temu Excel parser

**Files:**
- Create: `electron/sync/shopee.ts`
- Create: `electron/sync/tiktok.ts`
- Create: `electron/sync/temu.ts`

- [ ] **Step 1: Create electron/sync/shopee.ts**

```typescript
import { PlatformRow } from '../db/repositories/platform-repo';

interface ShopeeOrder {
  platform_order_id: string;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  status: string;
  platform_status: string;
  order_time: string;
}

export async function syncShopeeOrders(platform: PlatformRow): Promise<{ orders: ShopeeOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.partnerId || !auth.partnerKey || !auth.shopId) {
    return { orders: [], message: 'Shopee credentials not configured' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const baseUrl = 'https://partner.shopeemobile.com/api/v2';
  const params = {
    partner_id: Number(auth.partnerId),
    timestamp,
    sign: '', // Shopee requires HMAC-SHA256 signing
    shop_id: Number(auth.shopId),
    time_range_field: 'create_time',
    time_from: timestamp - 86400,
    time_to: timestamp,
    page_size: 100,
  };

  const res = await fetch(`${baseUrl}/order/get_order_list?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`Shopee API error: ${data.error} - ${data.message}`);

  const orderList = data.response?.order_list || [];
  return {
    orders: orderList.map((o: any) => ({
      platform_order_id: o.order_sn,
      sku: '',
      quantity: 1,
      unit_price: parseFloat(o.total_amount || '0'),
      currency: o.currency || 'USD',
      total_amount: parseFloat(o.total_amount || '0'),
      buyer_name: null,
      shipping_address: null,
      status: mapShopeeStatus(o.order_status),
      platform_status: o.order_status,
      order_time: new Date(o.create_time * 1000).toISOString(),
    })),
  };
}

function mapShopeeStatus(status: string): string {
  const map: Record<string, string> = {
    'UNPAID': 'pending', 'READY_TO_SHIP': 'matched', 'PROCESSED': 'matched',
    'SHIPPED': 'shipped', 'COMPLETED': 'delivered', 'CANCELLED': 'cancelled', 'IN_CANCEL': 'refunding',
  };
  return map[status] || 'pending';
}
```

- [ ] **Step 2: Create electron/sync/tiktok.ts**

```typescript
import { PlatformRow } from '../db/repositories/platform-repo';

export async function syncTikTokOrders(platform: PlatformRow): Promise<{ orders: any[]; message?: string }> {
  return {
    orders: [],
    message: 'TikTok Shop has no public API. Use the in-app browser login or Excel import.'
  };
}
```

- [ ] **Step 3: Create electron/sync/temu.ts**

```typescript
import * as XLSX from 'xlsx';
import fs from 'fs';
import { v4 as uuid } from 'uuid';

export function importTemuExcel(filePath: string): { orders: any[]; message: string } {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  const orders = rows.map((row: any) => ({
    platform_order_id: row['订单号'] || row['Order ID'] || uuid(),
    sku: row['SKU'] || row['商品SKU'] || '',
    quantity: parseInt(row['数量'] || row['Quantity'] || '1', 10),
    unit_price: parseFloat(row['单价'] || row['Unit Price'] || '0'),
    currency: 'USD',
    total_amount: parseFloat(row['金额'] || row['Amount'] || '0'),
    buyer_name: row['收货人'] || row['Buyer'] || null,
    shipping_address: row['收货地址'] || row['Shipping Address'] || null,
    status: 'pending',
    platform_status: row['状态'] || row['Status'] || '待发货',
    order_time: row['下单时间'] || row['Order Time'] || new Date().toISOString(),
  }));

  return { orders, message: `Parsed ${orders.length} orders from Excel` };
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/sync/shopee.ts electron/sync/tiktok.ts electron/sync/temu.ts && git commit -m "feat: add Shopee API connector, TikTok stub, Temu Excel parser"
```

---

## Phase 5: Order Management UI

### Task 5.1: App shell with router and sidebar layout

**Files:**
- Create: `src/App.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Header.tsx`
- Modify: `src/main.tsx` (wrap with HashRouter)

- [ ] **Step 1: Create src/App.tsx**

```typescript
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1677ff' } }}>
      <AntApp>
        <HashRouter>
          <div style={{ display: 'flex', height: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Header />
              <main style={{ flex: 1, padding: 24, overflow: 'auto', background: '#f5f5f5' }}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </div>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
```

- [ ] **Step 2: Create src/components/layout/Sidebar.tsx**

```typescript
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, ShoppingCartOutlined, InboxOutlined, SettingOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '经营仪表盘' },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
  { key: '/inventory', icon: <InboxOutlined />, label: '库存管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1677ff' }}>CrossFlow</h1>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0 }}
      />
    </Sider>
  );
};

export default Sidebar;
```

- [ ] **Step 3: Create src/components/layout/Header.tsx**

```typescript
import React from 'react';
import { Layout, Badge, Space } from 'antd';
import { BellOutlined, SyncOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Space size="middle">
        <SyncOutlined style={{ fontSize: 18, cursor: 'pointer' }} title="手动同步" />
        <Badge count={3} size="small">
          <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        </Badge>
      </Space>
    </AntHeader>
  );
};

export default Header;
```

- [ ] **Step 4: Create placeholder pages**

Create `src/pages/Orders/index.tsx`, `src/pages/Inventory/index.tsx`, `src/pages/Dashboard/index.tsx`, `src/pages/Settings/index.tsx` — each a component that renders a page title for now:

```typescript
import React from 'react';

const Orders: React.FC = () => {
  return <div><h2>订单管理</h2><p>Coming soon...</p></div>;
};

export default Orders;
```

(Repeat for Inventory, Dashboard, Settings.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/ src/pages/ && git commit -m "feat: add app shell with router, sidebar, header, and placeholder pages"
```

---

### Task 5.2: Order store + useIpc hook + Order page with table

**Files:**
- Create: `src/hooks/useIpc.ts`
- Create: `src/stores/order-store.ts`
- Create: `src/components/order/OrderStatusTag.tsx`
- Create: `src/components/order/OrderTable.tsx`
- Modify: `src/pages/Orders/index.tsx`

- [ ] **Step 1: Create src/hooks/useIpc.ts**

```typescript
export function useIpc() {
  const api = (window as any).electronAPI;
  if (!api) throw new Error('electronAPI not available — running outside Electron?');
  return {
    invoke: api.invoke as (channel: string, ...args: any[]) => Promise<any>,
    on: api.on as (channel: string, callback: (...args: any[]) => void) => () => void,
  };
}
```

- [ ] **Step 2: Create src/stores/order-store.ts**

```typescript
import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { Order, OrderFilter } from '../types/order';

interface OrderState {
  orders: Order[];
  total: number;
  loading: boolean;
  pendingCount: number;
  filter: OrderFilter;
  selectedRowKeys: string[];

  loadOrders: () => Promise<void>;
  setFilter: (filter: Partial<OrderFilter>) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  shipOrders: (ids: string[]) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  total: 0,
  loading: false,
  pendingCount: 0,
  filter: { page: 1, pageSize: 50 },
  selectedRowKeys: [],

  loadOrders: async () => {
    set({ loading: true });
    const api = (window as any).electronAPI;
    const { filter } = get();
    const result = await api.invoke(IPC.ORDERS_LIST, {
      status: filter.status,
      platformId: filter.platformId,
      sku: filter.sku,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      limit: filter.pageSize,
      offset: ((filter.page || 1) - 1) * (filter.pageSize || 50),
    });
    set({ orders: result.rows, total: result.total, loading: false });
  },

  setFilter: (partial) => {
    set((s) => ({ filter: { ...s.filter, ...partial } }));
    get().loadOrders();
  },

  setSelectedRowKeys: (keys) => set({ selectedRowKeys: keys }),

  shipOrders: async (ids) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.ORDERS_BATCH_SHIP, ids);
    get().loadOrders();
    get().refreshPendingCount();
  },

  refreshPendingCount: async () => {
    const api = (window as any).electronAPI;
    const count = await api.invoke(IPC.ORDERS_PENDING_COUNT);
    set({ pendingCount: count });
  },
}));
```

- [ ] **Step 3: Create src/components/order/OrderStatusTag.tsx**

```typescript
import React from 'react';
import { Tag } from 'antd';
import type { OrderStatus } from '../../types/order';

const statusConfig: Record<OrderStatus, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待处理' },
  matched: { color: 'blue', label: '已匹配' },
  shipped: { color: 'cyan', label: '已发货' },
  delivered: { color: 'green', label: '已签收' },
  refunding: { color: 'red', label: '退款中' },
  refunded: { color: 'volcano', label: '已退款' },
  cancelled: { color: 'default', label: '已取消' },
};

const OrderStatusTag: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const config = statusConfig[status] || { color: 'default', label: status };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default OrderStatusTag;
```

- [ ] **Step 4: Create src/components/order/OrderTable.tsx**

```typescript
import React from 'react';
import { Table, Button, Space, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useOrderStore } from '../../stores/order-store';
import OrderStatusTag from './OrderStatusTag';
import type { Order } from '../../types/order';

const columns: ColumnsType<Order> = [
  { title: '平台', dataIndex: 'platform_name', width: 80 },
  { title: '订单号', dataIndex: 'platform_order_id', width: 180, ellipsis: true },
  { title: 'SKU', dataIndex: 'sku', width: 120 },
  { title: '数量', dataIndex: 'quantity', width: 60 },
  { title: '金额', dataIndex: 'total_amount', width: 100, render: (v, r) => `${r.currency} ${v}` },
  { title: '状态', dataIndex: 'status', width: 100, render: (s) => <OrderStatusTag status={s} /> },
  { title: '下单时间', dataIndex: 'order_time', width: 160, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
];

const OrderTable: React.FC = () => {
  const { orders, total, loading, filter, selectedRowKeys, setFilter, setSelectedRowKeys, shipOrders } = useOrderStore();

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 120 }}
          placeholder="状态筛选"
          allowClear
          onChange={(v) => setFilter({ status: v })}
          options={[
            { label: '待处理', value: 'pending' },
            { label: '已发货', value: 'shipped' },
            { label: '退货', value: 'refunding' },
          ]}
        />
        <Button
          type="primary"
          disabled={selectedRowKeys.length === 0}
          onClick={() => shipOrders(selectedRowKeys)}
        >
          批量发货 ({selectedRowKeys.length})
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
        pagination={{
          current: filter.page,
          pageSize: filter.pageSize || 50,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setFilter({ page, pageSize }),
        }}
      />
    </div>
  );
};

export default OrderTable;
```

- [ ] **Step 5: Update src/pages/Orders/index.tsx**

```typescript
import React, { useEffect } from 'react';
import { Card, Typography } from 'antd';
import OrderTable from '../../components/order/OrderTable';
import { useOrderStore } from '../../stores/order-store';

const { Title } = Typography;

const Orders: React.FC = () => {
  const { loadOrders, refreshPendingCount } = useOrderStore();

  useEffect(() => {
    loadOrders();
    refreshPendingCount();
  }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>订单管理</Title>
      <Card>
        <OrderTable />
      </Card>
    </div>
  );
};

export default Orders;
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ src/stores/ src/components/order/ src/pages/Orders/ && git commit -m "feat: add order management page with table, filtering, and batch ship"
```

---

## Phase 6: Inventory Management UI

### Task 6.1: Inventory store + table + warehouse cards

**Files:**
- Create: `src/stores/inventory-store.ts`
- Create: `src/components/inventory/WarehouseCard.tsx`
- Create: `src/components/inventory/StockAlert.tsx`
- Create: `src/components/inventory/InventoryTable.tsx`
- Modify: `src/pages/Inventory/index.tsx`

- [ ] **Step 1: Create src/stores/inventory-store.ts**

```typescript
import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { InventoryItem, Warehouse } from '../types/inventory';

interface InventoryState {
  items: InventoryItem[];
  lowStock: InventoryItem[];
  warehouses: Warehouse[];
  loading: boolean;
  loadAll: () => Promise<void>;
  loadLowStock: () => Promise<void>;
  loadWarehouses: () => Promise<void>;
  restock: (productId: string, warehouseId: string, quantity: number, note?: string) => Promise<void>;
  receiveRestock: (productId: string, warehouseId: string, quantity: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  lowStock: [],
  warehouses: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const api = (window as any).electronAPI;
    const items = await api.invoke(IPC.INVENTORY_LIST);
    set({ items, loading: false });
  },

  loadLowStock: async () => {
    const api = (window as any).electronAPI;
    const lowStock = await api.invoke(IPC.INVENTORY_LOW_STOCK);
    set({ lowStock });
  },

  loadWarehouses: async () => {
    const api = (window as any).electronAPI;
    const warehouses = await api.invoke(IPC.WAREHOUSE_LIST);
    set({ warehouses });
  },

  restock: async (productId, warehouseId, quantity, note) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.INVENTORY_RESTOCK, productId, warehouseId, quantity, note);
    get().loadAll();
    get().loadLowStock();
  },

  receiveRestock: async (productId, warehouseId, quantity) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.INVENTORY_RECEIVE, productId, warehouseId, quantity);
    get().loadAll();
    get().loadLowStock();
  },
}));
```

- [ ] **Step 2: Create src/components/inventory/WarehouseCard.tsx**

```typescript
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import type { Warehouse } from '../../types/inventory';
import { useInventoryStore } from '../../stores/inventory-store';

const typeLabels: Record<string, string> = { domestic: '国内仓', fba: 'FBA仓', overseas: '海外仓' };

const WarehouseCard: React.FC<{ warehouse: Warehouse }> = ({ warehouse }) => {
  const items = useInventoryStore((s) => s.items.filter((i) => i.warehouse_id === warehouse.id));
  const totalAvailable = items.reduce((sum, i) => sum + i.available, 0);
  const totalReserved = items.reduce((sum, i) => sum + i.reserved, 0);
  const totalInTransit = items.reduce((sum, i) => sum + i.in_transit, 0);

  return (
    <Card title={`${warehouse.name} (${typeLabels[warehouse.type] || warehouse.type})`} size="small">
      <Row gutter={16}>
        <Col span={8}><Statistic title="可售" value={totalAvailable} /></Col>
        <Col span={8}><Statistic title="已占用" value={totalReserved} /></Col>
        <Col span={8}><Statistic title="在途" value={totalInTransit} /></Col>
      </Row>
    </Card>
  );
};

export default WarehouseCard;
```

- [ ] **Step 3: Create src/components/inventory/StockAlert.tsx**

```typescript
import React from 'react';
import { Alert, List } from 'antd';
import { useInventoryStore } from '../../stores/inventory-store';

const StockAlert: React.FC = () => {
  const lowStock = useInventoryStore((s) => s.lowStock);
  if (lowStock.length === 0) return null;

  return (
    <Alert
      type="error"
      message={`库存预警：${lowStock.length} 个SKU库存低于安全线`}
      description={
        <List size="small" dataSource={lowStock.slice(0, 5)} renderItem={(item) => (
          <List.Item>
            <strong>{item.sku}</strong> — {item.product_name} | 可售 {item.available} / 安全线 {item.safety_stock} | {item.warehouse_name}
          </List.Item>
        )} />
      }
      style={{ marginBottom: 16 }}
    />
  );
};

export default StockAlert;
```

- [ ] **Step 4: Create src/components/inventory/InventoryTable.tsx**

```typescript
import React, { useState } from 'react';
import { Table, Button, InputNumber, Modal, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useInventoryStore } from '../../stores/inventory-store';
import type { InventoryItem } from '../../types/inventory';

const InventoryTable: React.FC = () => {
  const { items, loading, restock, receiveRestock } = useInventoryStore();
  const [restockModal, setRestockModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [restockQty, setRestockQty] = useState(0);

  const columns: ColumnsType<InventoryItem> = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'product_name', width: 160 },
    { title: '仓库', dataIndex: 'warehouse_name', width: 100 },
    { title: '可售', dataIndex: 'available', width: 80, render: (v, r) => (
      <span style={{ color: v < r.safety_stock ? 'red' : 'inherit', fontWeight: v < r.safety_stock ? 'bold' : 'normal' }}>{v}</span>
    )},
    { title: '已占用', dataIndex: 'reserved', width: 80 },
    { title: '在途', dataIndex: 'in_transit', width: 80 },
    { title: '安全库存', dataIndex: 'safety_stock', width: 80 },
    {
      title: '操作', width: 200, render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setRestockModal({ open: true, item: record }); setRestockQty(0); }}>补货</Button>
          <Button size="small" onClick={() => receiveRestock(record.product_id, record.warehouse_id, record.in_transit)} disabled={record.in_transit <= 0}>到仓</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 条` }} />
      <Modal
        title="补货下单"
        open={restockModal.open}
        onCancel={() => setRestockModal({ open: false })}
        onOk={() => {
          if (restockModal.item && restockQty > 0) {
            restock(restockModal.item.product_id, restockModal.item.warehouse_id, restockQty);
            setRestockModal({ open: false });
          }
        }}
      >
        <p>SKU: {restockModal.item?.sku} — {restockModal.item?.product_name}</p>
        <p>仓库: {restockModal.item?.warehouse_name}</p>
        <InputNumber min={1} value={restockQty} onChange={(v) => setRestockQty(v || 0)} placeholder="补货数量" style={{ width: '100%' }} />
      </Modal>
    </>
  );
};

export default InventoryTable;
```

- [ ] **Step 5: Update src/pages/Inventory/index.tsx**

```typescript
import React, { useEffect } from 'react';
import { Card, Typography, Row, Col } from 'antd';
import { useInventoryStore } from '../../stores/inventory-store';
import StockAlert from '../../components/inventory/StockAlert';
import WarehouseCard from '../../components/inventory/WarehouseCard';
import InventoryTable from '../../components/inventory/InventoryTable';

const { Title } = Typography;

const Inventory: React.FC = () => {
  const { loadAll, loadLowStock, loadWarehouses, warehouses } = useInventoryStore();

  useEffect(() => {
    loadAll();
    loadLowStock();
    loadWarehouses();
  }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>库存管理</Title>
      <StockAlert />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {warehouses.map((w) => (
          <Col span={8} key={w.id}><WarehouseCard warehouse={w} /></Col>
        ))}
      </Row>
      <Card title="库存明细">
        <InventoryTable />
      </Card>
    </div>
  );
};

export default Inventory;
```

- [ ] **Step 6: Commit**

```bash
git add src/stores/inventory-store.ts src/components/inventory/ src/pages/Inventory/ && git commit -m "feat: add inventory management page with warehouse cards, stock alerts, and restock flow"
```

---

## Phase 7: Dashboard

### Task 7.1: Dashboard store + metric cards + charts

**Files:**
- Create: `src/stores/dashboard-store.ts`
- Create: `src/components/dashboard/MetricCard.tsx`
- Create: `src/components/dashboard/SalesChart.tsx`
- Create: `src/components/dashboard/PlatformPie.tsx`
- Create: `src/components/dashboard/StockAlertList.tsx`
- Modify: `src/pages/Dashboard/index.tsx`

- [ ] **Step 1: Create src/stores/dashboard-store.ts**

```typescript
import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { DashboardMetrics, SalesTrendPoint, PlatformSalesShare, SkuProfitRank } from '../types/dashboard';

interface DashboardState {
  metrics: DashboardMetrics | null;
  salesTrend: SalesTrendPoint[];
  platformShare: PlatformSalesShare[];
  skuProfit: SkuProfitRank[];
  lowStock: any[];
  loading: boolean;
  loadAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null,
  salesTrend: [],
  platformShare: [],
  skuProfit: [],
  lowStock: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const api = (window as any).electronAPI;
    const [metrics, salesTrend, platformShare, skuProfit, lowStock] = await Promise.all([
      api.invoke(IPC.DASHBOARD_METRICS),
      api.invoke(IPC.DASHBOARD_SALES_TREND, 30),
      api.invoke(IPC.DASHBOARD_PLATFORM_SHARE),
      api.invoke(IPC.DASHBOARD_SKU_PROFIT),
      api.invoke(IPC.INVENTORY_LOW_STOCK),
    ]);
    set({ metrics, salesTrend, platformShare, skuProfit, lowStock, loading: false });
  },
}));
```

- [ ] **Step 2: Create src/components/dashboard/MetricCard.tsx**

```typescript
import React from 'react';
import { Card, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface MetricCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  yesterdayValue?: number;
  format?: (v: number) => string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, prefix, suffix, yesterdayValue, format }) => {
  const diff = yesterdayValue !== undefined ? value - yesterdayValue : 0;
  const pct = yesterdayValue && yesterdayValue !== 0 ? Math.round((diff / yesterdayValue) * 100) : 0;

  const displayValue = format ? format(value) : String(value);

  return (
    <Card>
      <Statistic
        title={title}
        value={displayValue}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ fontSize: 28 }}
      />
      {yesterdayValue !== undefined && (
        <div style={{ marginTop: 8, fontSize: 13, color: diff >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {diff >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {' '}{diff >= 0 ? '+' : ''}{pct}% vs 昨日
        </div>
      )}
    </Card>
  );
};

export default MetricCard;
```

- [ ] **Step 3: Create src/components/dashboard/SalesChart.tsx**

```typescript
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboardStore } from '../../stores/dashboard-store';

const SalesChart: React.FC = () => {
  const { salesTrend } = useDashboardStore();
  const platforms = [...new Set(salesTrend.map((p) => p.platformName))];

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: platforms },
    xAxis: { type: 'category', data: [...new Set(salesTrend.map((p) => p.date))] },
    yAxis: { type: 'value' },
    series: platforms.map((name) => ({
      name,
      type: 'line',
      data: salesTrend.filter((p) => p.platformName === name).map((p) => p.revenue),
      smooth: true,
    })),
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
};

export default SalesChart;
```

- [ ] **Step 4: Create src/components/dashboard/PlatformPie.tsx**

```typescript
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboardStore } from '../../stores/dashboard-store';

const PlatformPie: React.FC = () => {
  const { platformShare } = useDashboardStore();

  const option = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: platformShare.map((p) => ({ name: p.platformName, value: p.revenue })),
      label: { formatter: '{b}\n{d}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
};

export default PlatformPie;
```

- [ ] **Step 5: Create src/components/dashboard/StockAlertList.tsx**

```typescript
import React from 'react';
import { List, Typography } from 'antd';
import { useDashboardStore } from '../../stores/dashboard-store';

const { Text } = Typography;

const StockAlertList: React.FC = () => {
  const { lowStock } = useDashboardStore();

  return (
    <List
      size="small"
      dataSource={lowStock}
      renderItem={(item: any) => (
        <List.Item>
          <Text strong>{item.sku}</Text>
          <Text type="secondary"> — {item.product_name} | {item.warehouse_name}</Text>
          <Text type="danger"> 可售{item.available}/安全线{item.safety_stock}</Text>
        </List.Item>
      )}
    />
  );
};

export default StockAlertList;
```

- [ ] **Step 6: Update src/pages/Dashboard/index.tsx**

```typescript
import React, { useEffect } from 'react';
import { Row, Col, Card, Typography } from 'antd';
import { useDashboardStore } from '../../stores/dashboard-store';
import MetricCard from '../../components/dashboard/MetricCard';
import SalesChart from '../../components/dashboard/SalesChart';
import PlatformPie from '../../components/dashboard/PlatformPie';
import StockAlertList from '../../components/dashboard/StockAlertList';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const { metrics, loadAll } = useDashboardStore();

  useEffect(() => { loadAll(); }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>经营仪表盘</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <MetricCard title="今日销售额" value={metrics?.todayRevenue || 0} prefix="$" yesterdayValue={metrics?.yesterdayRevenue} format={(v) => v.toFixed(2)} />
        </Col>
        <Col span={6}>
          <MetricCard title="今日订单" value={metrics?.todayOrderCount || 0} suffix="单" yesterdayValue={metrics?.yesterdayOrderCount} />
        </Col>
        <Col span={6}>
          <MetricCard title="SKU总数" value={metrics?.totalSkuCount || 0} suffix="个" />
        </Col>
        <Col span={6}>
          <MetricCard title="库存周转" value={23} suffix="天" />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="近30天销售趋势"><SalesChart /></Card>
        </Col>
        <Col span={8}>
          <Card title="平台销售占比"><PlatformPie /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="库存预警 TOP10"><StockAlertList /></Card>
        </Col>
        <Col span={12}>
          <Card title="待处理订单">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Title level={2} style={{ color: '#1677ff' }}>{metrics?.todayOrderCount || 0}</Title>
              <p>今日累计订单，实时更新</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
```

- [ ] **Step 7: Commit**

```bash
git add src/stores/dashboard-store.ts src/components/dashboard/ src/pages/Dashboard/ && git commit -m "feat: add dashboard with metrics, sales trend chart, platform pie, and stock alerts"
```

---

## Phase 8: Settings & Platform Auth

### Task 8.1: Settings store + page with platform configuration

**Files:**
- Create: `src/stores/settings-store.ts`
- Create: `src/components/shared/ImportExcel.tsx`
- Modify: `src/pages/Settings/index.tsx`

- [ ] **Step 1: Create src/stores/settings-store.ts**

```typescript
import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { PlatformConfig } from '../types/platform';

interface SettingsState {
  platforms: PlatformConfig[];
  loading: boolean;
  loadPlatforms: () => Promise<void>;
  saveAuth: (code: string, authData: Record<string, string>) => Promise<void>;
  toggleSync: (code: string, enabled: boolean) => Promise<void>;
  syncNow: (code: string) => Promise<{ status: string; records: number; message: string }>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  platforms: [],
  loading: false,

  loadPlatforms: async () => {
    set({ loading: true });
    const api = (window as any).electronAPI;
    const platforms = await api.invoke(IPC.PLATFORM_LIST);
    set({ platforms, loading: false });
  },

  saveAuth: async (code, authData) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.PLATFORM_SAVE_AUTH, code, authData);
    get().loadPlatforms();
  },

  toggleSync: async (code, enabled) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.PLATFORM_TOGGLE_SYNC, code, enabled);
    get().loadPlatforms();
  },

  syncNow: async (code) => {
    const api = (window as any).electronAPI;
    return api.invoke(IPC.PLATFORM_SYNC_NOW, code);
  },
}));
```

- [ ] **Step 2: Create src/components/shared/ImportExcel.tsx**

```typescript
import React, { useState } from 'react';
import { Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { IPC } from '../../shared/ipc-channels';

const ImportExcel: React.FC<{ platformCode: string; platformName: string; onImported: () => void }> = ({ platformCode, platformName, onImported }) => {
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const api = (window as any).electronAPI;
      const result = await api.invoke(IPC.ORDERS_IMPORT_EXCEL, file.path, platformCode);
      message.success(`导入完成：${result.message || `新增${result.orders?.length || 0}条订单`}`);
      onImported();
    } catch (err: any) {
      message.error(`导入失败：${err.message}`);
    } finally {
      setImporting(false);
    }
    return false;
  };

  return (
    <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls">
      <Button icon={<UploadOutlined />} loading={importing}>从{platformName}导入Excel订单</Button>
    </Upload>
  );
};

export default ImportExcel;
```

- [ ] **Step 3: Update src/pages/Settings/index.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Typography, List, Switch, Button, Tag, Modal, Form, Input, message, Space } from 'antd';
import { useSettingsStore } from '../../stores/settings-store';
import ImportExcel from '../../components/shared/ImportExcel';

const { Title } = Typography;

const platformDefaults = [
  { code: 'amazon', name: 'Amazon', fields: ['clientId', 'clientSecret', 'refreshToken', 'region'] },
  { code: 'shopee', name: 'Shopee', fields: ['partnerId', 'partnerKey', 'shopId'] },
  { code: 'tiktok', name: 'TikTok Shop', fields: [] },
  { code: 'temu', name: 'Temu', fields: [] },
  { code: 'lazada', name: 'Lazada', fields: ['appKey', 'appSecret', 'accessToken'] },
];

const Settings: React.FC = () => {
  const { platforms, loadPlatforms, saveAuth, toggleSync, syncNow } = useSettingsStore();
  const [authModal, setAuthModal] = useState<{ open: boolean; code: string; name: string; fields: string[] }>({ open: false, code: '', name: '', fields: [] });
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => { loadPlatforms(); }, []);

  const handleSyncNow = async (code: string) => {
    setSyncing(code);
    try {
      const result = await syncNow(code);
      if (result.status === 'failed') message.error(`同步失败：${result.message}`);
      else message.success(`同步完成：${result.records} 条`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>设置</Title>

      <Card title="平台管理" style={{ marginBottom: 16 }}>
        <List
          dataSource={platformDefaults}
          renderItem={(pd) => {
            const config = platforms.find((p) => p.code === pd.code);
            return (
              <List.Item
                actions={[
                  <Switch
                    key="sync"
                    checked={config?.syncEnabled ?? false}
                    onChange={(v) => toggleSync(pd.code, v)}
                  />,
                  <Button key="auth" size="small" onClick={() => {
                    setAuthModal({ open: true, code: pd.code, name: pd.name, fields: pd.fields });
                    form.resetFields();
                  }}>
                    {config?.authConfigured ? '更新授权' : '配置授权'}
                  </Button>,
                  <Button key="syncnow" size="small" loading={syncing === pd.code} onClick={() => handleSyncNow(pd.code)}>立即同步</Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Space>{pd.name} {config?.authConfigured && <Tag color="green">已授权</Tag>}</Space>}
                  description={`自动同步：${config?.syncEnabled ? '开启' : '关闭'} | 间隔：${(config?.syncInterval || 900) / 60}分钟`}
                />
                {(pd.code === 'temu' || pd.code === 'tiktok') && (
                  <ImportExcel platformCode={pd.code} platformName={pd.name} onImported={() => loadPlatforms()} />
                )}
              </List.Item>
            );
          }}
        />
      </Card>

      <Modal
        title={`配置 ${authModal.name} 授权`}
        open={authModal.open}
        onCancel={() => setAuthModal({ ...authModal, open: false })}
        onOk={async () => {
          const values = await form.validateFields();
          await saveAuth(authModal.code, values);
          setAuthModal({ ...authModal, open: false });
          message.success('授权信息已保存');
        }}
      >
        <Form form={form} layout="vertical">
          {authModal.fields.map((f) => (
            <Form.Item key={f} name={f} label={f} rules={[{ required: true, message: `请输入${f}` }]}>
              <Input.Password placeholder={f} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/settings-store.ts src/components/shared/ src/pages/Settings/ && git commit -m "feat: add settings page with platform auth config, sync toggle, and Excel import"
```

---

## Phase 9: AI Assistant

### Task 9.1: AI adapter with multi-provider support

**Files:**
- Create: `electron/ai/adapter.ts`
- Create: `electron/ai/prompts.ts`
- Create: `src/hooks/usePolling.ts`

- [ ] **Step 1: Create electron/ai/prompts.ts**

```typescript
export const PROMPTS = {
  translateProduct: (name: string, targetLang: string) =>
    `Translate this product name to ${targetLang}, keep it concise and suitable for e-commerce listing:\n\n${name}\n\nTranslation:`,

  classifyRefundReason: (reason: string) =>
    `Classify this refund/return reason into exactly one category: "quality" (product defect/damage), "logistics" (late/damaged in transit), "buyer" (changed mind/wrong order), or "other". Reply with only the category name.\n\nReason: ${reason}\n\nCategory:`,

  anomalyAlert: (context: string) =>
    `Based on this e-commerce data, write a concise alert message in Chinese for the seller (1-2 sentences max, no greeting):\n\n${context}\n\nAlert:`,
};
```

- [ ] **Step 2: Create electron/ai/adapter.ts**

```typescript
import OpenAI from 'openai';
import { PROMPTS } from './prompts';

type Provider = 'deepseek' | 'qwen' | 'glm' | 'ollama';

interface AiConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

const defaultModels: Record<Provider, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  glm: 'glm-4-flash',
  ollama: 'qwen2.5:7b',
};

const defaultBaseUrls: Record<Provider, string> = {
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  ollama: 'http://localhost:11434/v1',
};

export class AiAdapter {
  private client: OpenAI;
  private model: string;

  constructor(config: AiConfig) {
    this.model = config.model || defaultModels[config.provider];
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || defaultBaseUrls[config.provider],
    });
  }

  async translate(text: string, targetLang = 'English'): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.translateProduct(text, targetLang) }],
      max_tokens: 200,
      temperature: 0.3,
    });
    return res.choices[0]?.message?.content?.trim() || text;
  }

  async classifyRefundReason(reason: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.classifyRefundReason(reason) }],
      max_tokens: 10,
      temperature: 0,
    });
    return res.choices[0]?.message?.content?.trim() || 'other';
  }

  async generateAnomalyAlert(context: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: PROMPTS.anomalyAlert(context) }],
      max_tokens: 100,
      temperature: 0.5,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  }
}

let adapterInstance: AiAdapter | null = null;

export function getAiAdapter(config?: AiConfig): AiAdapter | null {
  if (config) {
    adapterInstance = new AiAdapter(config);
  }
  return adapterInstance;
}
```

- [ ] **Step 3: Create src/hooks/usePolling.ts**

```typescript
import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/ai/ src/hooks/usePolling.ts && git commit -m "feat: add AI adapter with DeepSeek/Qwen/GLM/Ollama support and polling hook"
```

---

## Phase 10: System Tray & Packaging

### Task 10.1: System tray with background sync

**Files:**
- Create: `electron/tray.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create electron/tray.ts**

```typescript
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
```

- [ ] **Step 2: Update electron/main.ts** to add tray and minimize-to-tray behavior

Add imports:
```typescript
import { createTray, destroyTray } from './tray';
```

After `createWindow()`, add:
```typescript
createTray(mainWindow!);

mainWindow!.on('close', (event) => {
  event.preventDefault();
  mainWindow!.hide();
});

mainWindow!.on('minimize', (event) => {
  event.preventDefault();
  mainWindow!.hide();
});
```

Add cleanup:
```typescript
app.on('before-quit', () => {
  destroyTray();
  closeDb();
});
```

- [ ] **Step 3: Commit**

```bash
git add electron/tray.ts && git commit -m "feat: add system tray with background sync and minimize-to-tray behavior"
```

---

### Task 10.2: electron-builder packaging config

**Files:**
- Modify: `electron-builder.yml`
- Create: `README.md`

- [ ] **Step 1: Update electron-builder.yml**

```yaml
appId: com.crossflow.app
productName: CrossFlow
copyright: Copyright © 2026

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - dist-electron/**/*

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.png

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: CrossFlow

mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  icon: resources/icon.png
  category: public.app-category.business

linux:
  target:
    - AppImage
  icon: resources/icon.png
  category: Office
```

- [ ] **Step 2: Create README.md**

```markdown
# CrossFlow

轻量级跨境电商工作流桌面端 — 把多平台订单处理和库存核对从2小时压缩到15分钟。

## 功能

- 多平台订单统一管理（Amazon / TikTok Shop / Temu / Shopee / Lazada）
- 智能库存管理（多仓库、防超卖、安全库存预警）
- 经营仪表盘（销售趋势、平台占比、库存预警）

## 技术栈

Electron 28 + React 18 + TypeScript + SQLite + Ant Design 5

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 许可

AGPL-3.0
```

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml README.md && git commit -m "chore: add electron-builder packaging config and README"
```

---

## Next Steps (V1.1+)

After V1.0 MVP is stable, these features are planned:

1. **物流轨迹追踪** — Track order shipping status via carrier APIs
2. **智能补货建议** — ML-based restock quantity prediction based on 30-day sales velocity
3. **TikTok Shop in-app browser auth** — Electron webview-based login for TikTok cookie capture
4. **SKU利润排行完善** — Integrate real cost data (ad spend, logistics fees) into profit calculations
5. **macOS compatibility testing** — Full test pass on macOS
