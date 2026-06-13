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

  // Merge
  ORDERS_MERGEABLE: 'orders:mergeable',
  ORDERS_MERGE: 'orders:merge',

  // Tracking
  TRACKING_CHECK: 'tracking:check',

  // AI
  AI_TRANSLATE: 'ai:translate',

  // Inventory (additional)
  INVENTORY_RESTOCK_SUGGESTIONS: 'inventory:restockSuggestions',

  // Supplier
  SUPPLIER_LIST: 'supplier:list',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_UPDATE: 'supplier:update',
  SUPPLIER_DELETE: 'supplier:delete',

  // Purchase Order
  PO_LIST: 'po:list',
  PO_CREATE: 'po:create',
  PO_UPDATE_STATUS: 'po:updateStatus',
  PO_DELETE: 'po:delete',

  // Reviews
  REVIEW_LIST: 'review:list',
  REVIEW_ALERTS: 'review:alerts',
  REVIEW_ACKNOWLEDGE: 'review:acknowledge',

  // Freight
  FREIGHT_LIST: 'freight:list',
  FREIGHT_CREATE: 'freight:create',

  // Finance
  FEE_CONFIG_LIST: 'feeConfig:list',
  FEE_CONFIG_SAVE: 'feeConfig:save',
  FINANCE_EXCHANGE_RATE: 'finance:exchangeRate',
  FINANCE_SUMMARY: 'finance:summary',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LIST_USERS: 'auth:listUsers',
  AUTH_CREATE_USER: 'auth:createUser',

  // Export
  EXPORT_ORDERS: 'export:orders',
  EXPORT_INVENTORY: 'export:inventory',
  EXPORT_PROFIT: 'export:profitReport',

  // Sync Log
  SYNC_LOG_RECENT: 'syncLog:recent',

  // AI (additional)
  AI_OPTIMIZE_LISTING: 'ai:optimizeListing',
  AI_CUSTOMER_REPLY: 'ai:customerReply',
} as const;
