import "@testing-library/jest-dom/vitest";
import "whatwg-fetch";

// Only run DOM polyfills when window exists (not in Node-only environments)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
}

// Shared mock data for store/component tests
export const MOCK_PRODUCTS = [
  { id: "p1", sku: "SKU-001", name: "Test Product", nameEn: "", imageUrl: null, category: "Electronics", costPrice: 15, weightKg: 0.2, safetyStock: 30, createdAt: "2025-01-01" },
  { id: "p2", sku: "SKU-002", name: "Another Product", nameEn: "", imageUrl: null, category: "Accessories", costPrice: 8, weightKg: 0.1, safetyStock: 50, createdAt: "2025-01-02" },
];

export const MOCK_ORDERS = [
  { id: "o1", platform_id: "p-amz", platform_name: "Amazon", platform_order_id: "AMZ-001", product_id: "p1", sku: "SKU-001", quantity: 2, unit_price: 29.99, currency: "USD", total_amount: 59.98, buyer_name: "John Doe", shipping_address: "123 Main St", logistics_provider: "UPS", tracking_number: "1Z999", status: "pending", platform_status: "Unshipped", order_time: "2025-06-01T10:00:00Z", shipped_time: null, synced_at: "2025-06-01T10:00:00Z" },
  { id: "o2", platform_id: "p-sp", platform_name: "Shopee", platform_order_id: "SP-001", product_id: "p1", sku: "SKU-001", quantity: 1, unit_price: 35.00, currency: "USD", total_amount: 35.00, buyer_name: "Jane Smith", shipping_address: null, logistics_provider: null, tracking_number: null, status: "shipped", platform_status: "Shipped", order_time: "2025-06-02T08:00:00Z", shipped_time: "2025-06-03T08:00:00Z", synced_at: "2025-06-02T08:00:00Z" },
];

export const MOCK_INVENTORY = [
  { id: "inv1", product_id: "p1", warehouse_id: "w1", sku: "SKU-001", product_name: "Test Product", warehouse_name: "Main Warehouse", warehouse_type: "domestic", available: 100, reserved: 10, in_transit: 20, safety_stock: 30, updated_at: "2025-06-04T00:00:00Z" },
  { id: "inv2", product_id: "p2", warehouse_id: "w1", sku: "SKU-002", product_name: "Another Product", warehouse_name: "Main Warehouse", warehouse_type: "domestic", available: 5, reserved: 0, in_transit: 0, safety_stock: 50, updated_at: "2025-06-04T00:00:00Z" },
];

export const MOCK_WAREHOUSES = [
  { id: "w1", name: "Main Warehouse", type: "domestic", country: "China", isDefault: true },
  { id: "w2", name: "FBA East", type: "fba", country: "US", isDefault: false },
];

export const MOCK_PLATFORMS = [
  { id: "p-amz", code: "amazon", name: "Amazon", authConfigured: true, syncEnabled: true, syncInterval: 900 },
  { id: "p-sp", code: "shopee", name: "Shopee", authConfigured: false, syncEnabled: false, syncInterval: 600 },
];

export const MOCK_DASHBOARD_METRICS = {
  todayRevenue: 1250.50, todayOrderCount: 18, yesterdayRevenue: 980.25, yesterdayOrderCount: 15,
  avgInventoryTurnoverDays: 23, totalSkuCount: 2,
};

export const MOCK_SALES_TREND = [
  { date: "2025-06-01", revenue: 500, orderCount: 8, platformId: "p-amz", platformName: "Amazon" },
  { date: "2025-06-01", revenue: 300, orderCount: 5, platformId: "p-sp", platformName: "Shopee" },
];

export function createMockElectronAPI(overrides?: Record<string, any>) {
  const defaults: Record<string, (...args: any[]) => any> = {
    "platform:list": () => MOCK_PLATFORMS,
    "warehouse:list": () => MOCK_WAREHOUSES,
    "product:list": () => MOCK_PRODUCTS,
    "product:search": (q: string) => MOCK_PRODUCTS.filter(p => p.sku.includes(q) || p.name.includes(q)),
    "orders:list": (filter: any) => {
      let rows = [...MOCK_ORDERS];
      if (filter?.status) rows = rows.filter(o => o.status === filter.status);
      if (filter?.platformId) rows = rows.filter(o => o.platform_id === filter.platformId);
      const limit = filter?.limit || 50;
      const offset = filter?.offset || 0;
      return { rows: rows.slice(offset, offset + limit), total: rows.length };
    },
    "orders:get": (id: string) => MOCK_ORDERS.find(o => o.id === id) || null,
    "orders:pendingCount": () => MOCK_ORDERS.filter(o => o.status === "pending").length,
    "orders:batchShip": () => {},
    "orders:updateStatus": () => {},
    "orders:importExcel": () => ({ orders: [], message: "OK" }),
    "inventory:list": () => MOCK_INVENTORY,
    "inventory:lowStock": () => MOCK_INVENTORY.filter(i => i.available < i.safety_stock),
    "inventory:restock": () => {},
    "inventory:receive": () => {},
    "inventory:logs": () => [],
    "inventory:pauseSku": () => ({ success: true }),
    "inventory:restockSuggestions": () => [],
    "dashboard:metrics": () => MOCK_DASHBOARD_METRICS,
    "dashboard:salesTrend": () => MOCK_SALES_TREND,
    "dashboard:platformShare": () => [{platformId:"p-amz",platformName:"Amazon",revenue:4500,percentage:60}],
    "dashboard:skuProfit": () => [{sku:"SKU-001",productName:"Test",revenue:2000,orderCount:20,estimatedProfit:800}],
    "platform:saveAuth": () => {},
    "platform:toggleSync": () => {},
    "platform:syncNow": () => ({ status: "success", records: 10, message: "OK" }),
    "settings:get": () => ({ language: "zh-CN", autoLaunch: false, minimizeToTray: true, aiProvider: "deepseek", aiApiKey: "", backupPath: "" }),
    "settings:set": () => {},
    "orders:mergeable": () => [],
    "orders:merge": () => ({ success: true, message: "Merged" }),
  };

  const mock = { ...defaults, ...overrides };

  (window as any).electronAPI = {
    invoke: async (channel: string, ...args: any[]) => {
      const fn = mock[channel];
      if (!fn) return null;
      try { return await Promise.resolve(fn(...args)); }
      catch (e) { return Promise.reject(e); }
    },
    on: () => () => {},
  };
}

// Auto-setup for jsdom tests
if (typeof window !== "undefined") {
  beforeEach(() => {
    createMockElectronAPI();
  });
}



