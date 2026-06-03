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
