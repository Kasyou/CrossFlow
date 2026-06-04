// Realistic mock data for cross-border e-commerce testing

export const platforms = [
  { id: 'p-amz', code: 'amazon', name: 'Amazon', authConfigured: true, syncEnabled: true, syncInterval: 900 },
  { id: 'p-tt', code: 'tiktok', name: 'TikTok Shop', authConfigured: false, syncEnabled: true, syncInterval: 1800 },
  { id: 'p-tm', code: 'temu', name: 'Temu', authConfigured: false, syncEnabled: false, syncInterval: 900 },
  { id: 'p-sp', code: 'shopee', name: 'Shopee', authConfigured: true, syncEnabled: true, syncInterval: 600 },
  { id: 'p-lz', code: 'lazada', name: 'Lazada', authConfigured: false, syncEnabled: false, syncInterval: 900 },
];

export const warehouses = [
  { id: 'w-gz', name: '广州仓', type: 'domestic', country: '中国', isDefault: true },
  { id: 'w-fba', name: 'FBA美东', type: 'fba', country: '美国', isDefault: false },
  { id: 'w-la', name: '海外仓LA', type: 'overseas', country: '美国', isDefault: false },
];

export const products = [
  { id: 'sku-001', sku: 'BT-EP10-BK', name: '蓝牙耳机Pro', nameEn: 'Bluetooth Earbuds Pro', costPrice: 28, weightKg: 0.15, safetyStock: 30, category: '电子产品' },
  { id: 'sku-002', sku: 'PH-CASE-15PM', name: 'iPhone 15 Pro Max手机壳', nameEn: 'iPhone 15 Pro Max Case', costPrice: 5, weightKg: 0.08, safetyStock: 50, category: '手机配件' },
  { id: 'sku-003', sku: 'CBL-USB-C-1M', name: 'USB-C快充数据线1米', nameEn: 'USB-C Fast Charging Cable 1M', costPrice: 3.5, weightKg: 0.04, safetyStock: 100, category: '数据线' },
  { id: 'sku-004', sku: 'CHGR-GAN-65W', name: '65W氮化镓充电器', nameEn: '65W GaN Charger', costPrice: 22, weightKg: 0.12, safetyStock: 40, category: '充电器' },
  { id: 'sku-005', sku: 'LED-DESK-LAMP', name: 'LED护眼台灯', nameEn: 'LED Eye-Care Desk Lamp', costPrice: 45, weightKg: 1.2, safetyStock: 20, category: '家居' },
  { id: 'sku-006', sku: 'PET-TOY-BALL', name: '宠物智能玩具球', nameEn: 'Smart Pet Toy Ball', costPrice: 18, weightKg: 0.2, safetyStock: 25, category: '宠物用品' },
  { id: 'sku-007', sku: 'CAR-MOUNT-MAG', name: '磁吸车载手机支架', nameEn: 'Magnetic Car Phone Mount', costPrice: 8, weightKg: 0.1, safetyStock: 60, category: '车载配件' },
  { id: 'sku-008', sku: 'SPK-BT-MINI', name: '迷你蓝牙音箱', nameEn: 'Mini Bluetooth Speaker', costPrice: 35, weightKg: 0.3, safetyStock: 15, category: '电子产品' },
  { id: 'sku-009', sku: 'WATCH-BAND-SL', name: '硅胶表带', nameEn: 'Silicone Watch Band', costPrice: 4.5, weightKg: 0.03, safetyStock: 200, category: '手表配件' },
  { id: 'sku-010', sku: 'KEYBOARD-MECH', name: '机械键盘87键', nameEn: 'Mechanical Keyboard 87 Keys', costPrice: 120, weightKg: 0.9, safetyStock: 10, category: '电子产品' },
];

const buyers = ['John Smith', 'Maria Garcia', 'Alex Johnson', 'Sarah Kim', 'Mike Brown', 'Emily Davis', 'Tom Wilson', null];
const addresses = [
  '{"street":"123 Main St","city":"Los Angeles","state":"CA","zip":"90001"}',
  '{"street":"456 Oak Ave","city":"New York","state":"NY","zip":"10001"}',
  '{"street":"789 Pine Rd","city":"Chicago","state":"IL","zip":"60601"}',
  '{"street":"321 Elm Blvd","city":"Houston","state":"TX","zip":"77001"}',
  '{"street":"654 Maple Dr","city":"Miami","state":"FL","zip":"33101"}',
  null, null,
];

const orderStatuses = ['pending', 'pending', 'pending', 'matched', 'matched', 'shipped', 'shipped', 'shipped', 'delivered', 'refunding', 'refunded', 'cancelled'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateOrders(count: number) {
  const orders: any[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const product = pick(products);
    const platform = pick(platforms);
    const qty = Math.floor(Math.random() * 5) + 1;
    const unitPrice = product.costPrice * (Math.random() * 2 + 1.5);
    const orderTime = new Date(now - Math.random() * 30 * 86400000).toISOString();
    const status = pick(orderStatuses);
    let shippedTime: string | null = null;
    let tracking: string | null = null;
    let logistics: string | null = null;

    if (['shipped', 'delivered'].includes(status)) {
      shippedTime = new Date(new Date(orderTime).getTime() + Math.random() * 7 * 86400000).toISOString();
      tracking = `1Z${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      logistics = pick(['UPS', 'FedEx', 'DHL', 'USPS']);
    }

    orders.push({
      id: `order-${i}`,
      platform_id: platform.id,
      platform_name: platform.name,
      platform_order_id: `${platform.code === 'amazon' ? '113-' : platform.code === 'shopee' ? 'SP' : 'TM'}${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      product_id: product.id,
      sku: product.sku,
      quantity: qty,
      unit_price: parseFloat(unitPrice.toFixed(2)),
      currency: 'USD',
      total_amount: parseFloat((unitPrice * qty).toFixed(2)),
      buyer_name: pick(buyers),
      shipping_address: pick(addresses),
      logistics_provider: logistics,
      tracking_number: tracking,
      status,
      platform_status: status === 'pending' ? 'Unshipped' : status === 'shipped' ? 'Shipped' : status,
      order_time: orderTime,
      shipped_time: shippedTime,
      synced_at: orderTime,
    });
  }

  return orders;
}

export function generateInventory() {
  const data: any[] = [];
  for (const product of products) {
    for (const wh of warehouses) {
      const available = Math.floor(product.safetyStock * (Math.random() * 2 + 0.2));
      data.push({
        id: `inv-${product.id}-${wh.id}`,
        product_id: product.id,
        warehouse_id: wh.id,
        sku: product.sku,
        product_name: product.name,
        warehouse_name: wh.name,
        warehouse_type: wh.type,
        available,
        reserved: Math.floor(available * Math.random() * 0.3),
        in_transit: Math.floor(product.safetyStock * Math.random() * 0.5),
        safety_stock: product.safetyStock,
        updated_at: new Date().toISOString(),
      });
    }
  }
  // Make some SKUs critically low
  data[0].available = 3;   // 蓝牙耳机-广州仓: 3/30 safety
  data[3].available = 1;   // 65W充电器-广州仓: 1/40 safety
  data[7].available = 0;   // 迷你蓝牙音箱-FBA: 0/15 safety (OOS!)
  return data;
}
