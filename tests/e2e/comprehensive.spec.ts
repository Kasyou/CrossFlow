/**
 * Comprehensive E2E Test for CrossFlow
 * Tests all modules with realistic mock data.
 * Run: npx playwright test tests/e2e/comprehensive.spec.ts --reporter=list
 */

import { test, expect, Page } from '@playwright/test';

// We inject mock data by overriding window.electronAPI BEFORE the app loads.
// The mock is embedded directly in a script string to avoid serialization issues.

const MOCK_SCRIPT = `
window.__mockData = {
  platforms: [
    { id: 'p-amz', code: 'amazon', name: 'Amazon', authConfigured: true, syncEnabled: true, syncInterval: 900 },
    { id: 'p-tt', code: 'tiktok', name: 'TikTok Shop', authConfigured: false, syncEnabled: true, syncInterval: 1800 },
    { id: 'p-tm', code: 'temu', name: 'Temu', authConfigured: false, syncEnabled: false, syncInterval: 900 },
    { id: 'p-sp', code: 'shopee', name: 'Shopee', authConfigured: true, syncEnabled: true, syncInterval: 600 },
    { id: 'p-lz', code: 'lazada', name: 'Lazada', authConfigured: false, syncEnabled: false, syncInterval: 900 }
  ],
  warehouses: [
    { id: 'w-gz', name: '广州仓', type: 'domestic', country: '中国', isDefault: true },
    { id: 'w-fba', name: 'FBA美东', type: 'fba', country: '美国', isDefault: false },
    { id: 'w-la', name: '海外仓LA', type: 'overseas', country: '美国', isDefault: false }
  ],
  products: [
    { id: 'sku-001', sku: 'BT-EP10-BK', name: '蓝牙耳机Pro', costPrice: 28, safetyStock: 30, weightKg: 0.15, category: '电子产品' },
    { id: 'sku-002', sku: 'PH-CASE-15PM', name: 'iPhone 15 Pro Max手机壳', costPrice: 5, safetyStock: 50, weightKg: 0.08, category: '手机配件' },
    { id: 'sku-003', sku: 'CBL-USB-C-1M', name: 'USB-C快充数据线1米', costPrice: 3.5, safetyStock: 100, weightKg: 0.04, category: '数据线' },
    { id: 'sku-004', sku: 'CHGR-GAN-65W', name: '65W氮化镓充电器', costPrice: 22, safetyStock: 40, weightKg: 0.12, category: '充电器' },
    { id: 'sku-005', sku: 'LED-DESK-LAMP', name: 'LED护眼台灯', costPrice: 45, safetyStock: 20, weightKg: 1.2, category: '家居' },
    { id: 'sku-006', sku: 'PET-TOY-BALL', name: '宠物智能玩具球', costPrice: 18, safetyStock: 25, weightKg: 0.2, category: '宠物用品' },
    { id: 'sku-007', sku: 'CAR-MOUNT-MAG', name: '磁吸车载手机支架', costPrice: 8, safetyStock: 60, weightKg: 0.1, category: '车载配件' },
    { id: 'sku-008', sku: 'SPK-BT-MINI', name: '迷你蓝牙音箱', costPrice: 35, safetyStock: 15, weightKg: 0.3, category: '电子产品' },
    { id: 'sku-009', sku: 'WATCH-BAND-SL', name: '硅胶表带', costPrice: 4.5, safetyStock: 200, weightKg: 0.03, category: '手表配件' },
    { id: 'sku-010', sku: 'KEYBOARD-MECH', name: '机械键盘87键', costPrice: 120, safetyStock: 10, weightKg: 0.9, category: '电子产品' }
  ]
};

// Generate mock orders
window.__mockData.orders = [];
var platforms = window.__mockData.platforms;
var products = window.__mockData.products;
var statuses = ['pending','pending','pending','matched','matched','shipped','shipped','shipped','delivered','refunding','refunded','cancelled'];
var buyers = ['John Smith','Maria Garcia','Alex Johnson','Sarah Kim','Mike Brown','Emily Davis',null];
for (var i = 0; i < 50; i++) {
  var p = products[i % products.length];
  var plat = platforms[i % 4];
  var st = statuses[i % statuses.length];
  window.__mockData.orders.push({
    id: 'order-' + i,
    platform_id: plat.id,
    platform_name: plat.name,
    platform_order_id: (plat.code === 'amazon' ? '113-' : plat.code === 'shopee' ? 'SP-' : 'TM-') + Math.random().toString(36).slice(2,10).toUpperCase(),
    sku: p.sku,
    product_id: p.id,
    quantity: (i % 3) + 1,
    unit_price: (p.costPrice * (1.5 + Math.random())).toFixed(2),
    currency: 'USD',
    total_amount: (p.costPrice * ((i % 3) + 1) * (1.5 + Math.random())).toFixed(2),
    buyer_name: buyers[i % buyers.length],
    shipping_address: i % 3 !== 0 ? '{"city":"NY"}' : null,
    logistics_provider: ['shipped','delivered'].includes(st) ? ['UPS','FedEx','DHL'][i%3] : null,
    tracking_number: ['shipped','delivered'].includes(st) ? '1Z' + Math.random().toString(36).slice(2,10).toUpperCase() : null,
    status: st,
    platform_status: st,
    order_time: new Date(Date.now() - i * 43200000).toISOString(),
    shipped_time: ['shipped','delivered'].includes(st) ? new Date(Date.now() - i * 21600000).toISOString() : null,
    synced_at: new Date().toISOString()
  });
}

// Generate mock inventory
window.__mockData.inventory = [];
var warehouses = window.__mockData.warehouses;
for (var pi = 0; pi < products.length; pi++) {
  for (var wi = 0; wi < warehouses.length; wi++) {
    var avail = Math.floor(products[pi].safetyStock * (0.2 + Math.random() * 2));
    window.__mockData.inventory.push({
      id: 'inv-' + products[pi].id + '-' + warehouses[wi].id,
      product_id: products[pi].id,
      warehouse_id: warehouses[wi].id,
      sku: products[pi].sku,
      product_name: products[pi].name,
      warehouse_name: warehouses[wi].name,
      warehouse_type: warehouses[wi].type,
      available: avail,
      reserved: Math.floor(avail * 0.2),
      in_transit: Math.floor(products[pi].safetyStock * 0.3),
      safety_stock: products[pi].safetyStock,
      updated_at: new Date().toISOString()
    });
  }
}
// Critical low stock items
window.__mockData.inventory[0].available = 3;
window.__mockData.inventory[3].available = 1;
window.__mockData.inventory[7].available = 0;

var todayRevenue = 0; var todayOrders = 0;
window.__mockData.orders.forEach(function(o) {
  if (o.status !== 'cancelled' && o.status !== 'refunded') {
    todayRevenue += parseFloat(o.total_amount);
    todayOrders++;
  }
});
window.__mockData.dashboardMetrics = {
  todayRevenue: todayRevenue, todayOrderCount: todayOrders,
  yesterdayRevenue: todayRevenue * 0.8, yesterdayOrderCount: Math.floor(todayOrders * 0.85),
  avgInventoryTurnoverDays: 23, totalSkuCount: products.length
};
window.__mockData.lowStock = window.__mockData.inventory.filter(function(i) { return i.available < i.safety_stock; });

// IPC mock
window.electronAPI = {
  invoke: function(channel) {
    var args = Array.prototype.slice.call(arguments, 1);
    var d = window.__mockData;
    var map = {
      'platform:list': function() { return d.platforms; },
      'warehouse:list': function() { return d.warehouses; },
      'product:list': function() { return d.products; },
      'product:search': function(q) { return d.products.filter(function(p) { return p.sku.indexOf(q) >= 0 || p.name.indexOf(q) >= 0; }); },
      'orders:list': function(filter) {
        var result = d.orders.slice();
        if (filter && filter.status) result = result.filter(function(o) { return o.status === filter.status; });
        if (filter && filter.platformId) result = result.filter(function(o) { return o.platform_id === filter.platformId; });
        var limit = (filter && filter.limit) || 50;
        var offset = (filter && filter.offset) || 0;
        return { rows: result.slice(offset, offset + limit), total: result.length };
      },
      'orders:get': function(id) { return d.orders.find(function(o) { return o.id === id; }); },
      'orders:pendingCount': function() { return d.orders.filter(function(o) { return o.status === 'pending' || o.status === 'matched'; }).length; },
      'orders:batchShip': function() {},
      'orders:updateStatus': function() {},
      'orders:importExcel': function() { return { orders: [], message: 'No file' }; },
      'inventory:list': function() { return d.inventory; },
      'inventory:lowStock': function() { return d.lowStock; },
      'inventory:restock': function() {},
      'inventory:receive': function() {},
      'inventory:logs': function() { return []; },
      'inventory:pauseSku': function() {},
      'dashboard:metrics': function() { return d.dashboardMetrics; },
      'dashboard:salesTrend': function() {
        var items = [];
        for (var i = 30; i >= 0; i--) {
          var date = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
          d.platforms.slice(0,4).forEach(function(p) {
            items.push({ date: date, revenue: Math.floor(Math.random() * 500 + 100), orderCount: Math.floor(Math.random() * 10 + 1), platformId: p.id, platformName: p.name });
          });
        }
        return items;
      },
      'dashboard:platformShare': function() { return [
        { platformId: 'p-amz', platformName: 'Amazon', revenue: 4500, percentage: 45 },
        { platformId: 'p-tt', platformName: 'TikTok Shop', revenue: 2800, percentage: 28 },
        { platformId: 'p-tm', platformName: 'Temu', revenue: 1800, percentage: 18 },
        { platformId: 'p-sp', platformName: 'Shopee', revenue: 900, percentage: 9 }
      ];},
      'dashboard:skuProfit': function() { return d.products.slice(0,5).map(function(p) { return { sku: p.sku, productName: p.name, revenue: 2000, orderCount: 20, estimatedProfit: 800 }; }); },
      'platform:saveAuth': function() {},
      'platform:toggleSync': function() {},
      'platform:syncNow': function() { return { status: 'success', records: 12, message: 'OK' }; },
      'settings:get': function() { return { language:'zh-CN', autoLaunch:false, minimizeToTray:true, aiProvider:'deepseek', aiApiKey:'', backupPath:'' }; },
      'settings:set': function() {}
    };
    var fn = map[channel];
    if (fn) { try { return Promise.resolve(fn.apply(null, args)); } catch(e) { return Promise.reject(e); } }
    return Promise.resolve(null);
  },
  on: function() { return function() {}; }
};
`;

async function setupPage(page: Page) {
  await page.addInitScript(MOCK_SCRIPT);
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html#/dashboard');
    await page.waitForTimeout(2000);
  });

  test('D01: page title and heading render', async ({ page }) => {
    await expect(page).toHaveTitle('CrossFlow');
    await expect(page.locator('h3')).toContainText('经营仪表盘');
  });

  test('D02: 4 metric cards visible', async ({ page }) => {
    await expect(page.locator('.ant-statistic')).toHaveCount(4);
  });

  test('D03: sales trend chart area renders', async ({ page }) => {
    await expect(page.getByText('近30天销售趋势')).toBeVisible();
  });

  test('D04: platform share pie area renders', async ({ page }) => {
    await expect(page.getByText('平台销售占比')).toBeVisible();
  });

  test('D05: stock alert TOP10 section visible', async ({ page }) => {
    await expect(page.getByText('库存预警 TOP10')).toBeVisible();
  });

  test('D06: SKU profit ranking card visible', async ({ page }) => {
    await expect(page.getByText('SKU利润排行')).toBeVisible();
  });
});

test.describe('Orders', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html#/orders');
    await page.waitForTimeout(2000);
  });

  test('O01: table shows data rows', async ({ page }) => {
    const rows = page.locator('.ant-table-tbody tr.ant-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test('O02: status filter dropdown exists', async ({ page }) => {
    await expect(page.locator('.ant-select').first()).toBeVisible();
  });

  test('O03: batch ship button starts disabled', async ({ page }) => {
    const btn = page.getByRole('button', { name: /批量发货/ });
    await expect(btn).toBeDisabled();
  });

  test('O04: select rows enables batch ship', async ({ page }) => {
    const cb = page.locator('.ant-table-tbody .ant-checkbox-input').first();
    await cb.check();
    await expect(page.getByRole('button', { name: /批量发货/ })).toBeEnabled({ timeout: 3000 });
  });

  test('O05: columns show correct headers', async ({ page }) => {
    await expect(page.locator('.ant-table-thead')).toContainText('平台');
    await expect(page.locator('.ant-table-thead')).toContainText('订单号');
    await expect(page.locator('.ant-table-thead')).toContainText('SKU');
    await expect(page.locator('.ant-table-thead')).toContainText('状态');
    await expect(page.locator('.ant-table-thead')).toContainText('下单时间');
  });

  test('O06: pagination shows', async ({ page }) => {
    await expect(page.locator('.ant-pagination')).toBeVisible();
  });
});

test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html#/inventory');
    await page.waitForTimeout(2000);
  });

  test('I01: stock alert banner for low stock', async ({ page }) => {
    const alert = page.locator('.ant-alert-error');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('库存预警');
  });

  test('I02: inventory table renders', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('I03: columns show headers', async ({ page }) => {
    const headers = page.locator('.ant-table-thead');
    await expect(headers).toContainText('SKU');
    await expect(headers).toContainText('商品名称');
    await expect(headers).toContainText('可售');
    await expect(headers).toContainText('已占用');
    await expect(headers).toContainText('在途');
    await expect(headers).toContainText('安全库存');
  });

  test('I04: restock modal opens and closes', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /补/ }).first();
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.ant-modal')).toContainText('补货下单');
    await page.locator('.ant-modal-close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.ant-modal')).not.toBeVisible({ timeout: 2000 });
  });

  test('I05: restock modal has input field', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /补/ }).first();
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(page.locator('.ant-modal .ant-input-number')).toBeVisible();
    await page.locator('.ant-modal .ant-btn-default').first().click();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html#/settings');
    await page.waitForTimeout(2000);
  });

  test('S01: 5 platforms listed', async ({ page }) => {
    await expect(page.locator('.ant-list-item')).toHaveCount(5);
  });

  test('S02: Amazon shows authorized tag', async ({ page }) => {
    const item = page.locator('.ant-list-item').filter({ hasText: 'Amazon' });
    await expect(item).toContainText('已授权');
  });

  test('S03: auth modal opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: '配置授权' }).first().click();
    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.ant-modal')).toContainText('配置');
    await page.locator('.ant-modal .ant-btn-default').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('.ant-modal')).not.toBeVisible({ timeout: 2000 });
  });

  test('S04: sync toggle switches visible', async ({ page }) => {
    await expect(page.locator('.ant-switch').first()).toBeVisible();
  });

  test('S05: Temu has Excel import button', async ({ page }) => {
    const item = page.locator('.ant-list-item').filter({ hasText: 'Temu' });
    await expect(item.locator('button').filter({ hasText: /导入/ })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html#/dashboard');
    await page.waitForTimeout(1000);
  });

  test('N01: navigate to Orders', async ({ page }) => {
    await page.locator('.ant-menu-item').filter({ hasText: '订单管理' }).click();
    await expect(page).toHaveURL(/#\/orders/);
    await expect(page.locator('h3')).toContainText('订单管理');
  });

  test('N02: navigate to Inventory', async ({ page }) => {
    await page.locator('.ant-menu-item').filter({ hasText: '库存管理' }).click();
    await expect(page).toHaveURL(/#\/inventory/);
    await expect(page.locator('h3')).toContainText('库存管理');
  });

  test('N03: navigate to Settings', async ({ page }) => {
    await page.locator('.ant-menu-item').filter({ hasText: '设置' }).click();
    await expect(page).toHaveURL(/#\/settings/);
    await expect(page.locator('h3')).toContainText('设置');
  });

  test('N04: navigate back to Dashboard', async ({ page }) => {
    await page.locator('.ant-menu-item').filter({ hasText: '订单管理' }).click();
    await page.locator('.ant-menu-item').filter({ hasText: '经营仪表盘' }).click();
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test('N05: branding visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('CrossFlow');
  });

  test('N06: bell popover opens', async ({ page }) => {
    await page.locator('.anticon-bell').click();
    await expect(page.locator('.ant-popover')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.ant-popover')).toContainText('同步通知');
  });

  test('N07: sync button clickable', async ({ page }) => {
    await page.locator('.anticon-sync').click();
    await page.waitForTimeout(500);
    // Should not crash
    await expect(page.locator('h1')).toContainText('CrossFlow');
  });
});

test.describe('Edge Cases', () => {
  test('E01: empty inventory shows placeholder', async ({ page }) => {
    await page.addInitScript(`
      window.electronAPI = {
        invoke: function(ch) {
          if (ch === 'inventory:list') return Promise.resolve([]);
          if (ch === 'inventory:lowStock') return Promise.resolve([]);
          if (ch === 'warehouse:list') return Promise.resolve([]);
          return Promise.resolve(null);
        },
        on: function() { return function() {}; }
      };
    `);
    await page.goto('http://localhost:5173/src/index.html#/inventory');
    await page.waitForTimeout(2000);
    await expect(page.locator('.ant-empty')).toBeVisible({ timeout: 5000 });
  });

  test('E02: empty orders shows placeholder', async ({ page }) => {
    await page.addInitScript(`
      window.electronAPI = {
        invoke: function(ch) {
          if (ch === 'orders:list') return Promise.resolve({ rows: [], total: 0 });
          if (ch === 'platform:list') return Promise.resolve([]);
          return Promise.resolve(null);
        },
        on: function() { return function() {}; }
      };
    `);
    await page.goto('http://localhost:5173/src/index.html#/orders');
    await page.waitForTimeout(2000);
    await expect(page.locator('.ant-empty')).toBeVisible({ timeout: 5000 });
  });

  test('E03: rapid tab switching no crash', async ({ page }) => {
    await setupPage(page);
    await page.goto('http://localhost:5173/src/index.html');
    await page.waitForTimeout(1000);

    await page.locator('.ant-menu-item').filter({ hasText: '订单管理' }).click();
    await page.waitForTimeout(200);
    await page.locator('.ant-menu-item').filter({ hasText: '库存管理' }).click();
    await page.waitForTimeout(200);
    await page.locator('.ant-menu-item').filter({ hasText: '设置' }).click();
    await page.waitForTimeout(200);
    await page.locator('.ant-menu-item').filter({ hasText: '经营仪表盘' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('h1')).toContainText('CrossFlow');
  });
});
