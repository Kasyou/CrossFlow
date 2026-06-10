import { createHmac } from 'crypto';
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

function signShopeeRequest(path: string, params: Record<string, string>, partnerKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const baseString = path + '|' + sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  return createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export async function syncShopeeOrders(platform: PlatformRow): Promise<{ orders: ShopeeOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.partnerId || !auth.partnerKey || !auth.shopId) {
    return { orders: [], message: 'Shopee credentials not configured' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/order/get_order_list';
  const queryParams: Record<string, string> = {
    partner_id: String(auth.partnerId),
    timestamp: String(timestamp),
    shop_id: String(auth.shopId),
    time_range_field: 'create_time',
    time_from: String(timestamp - 86400),
    time_to: String(timestamp),
    page_size: '100',
  };
  queryParams.sign = signShopeeRequest(path, queryParams, String(auth.partnerKey));

  const params = new URLSearchParams(queryParams);
  const res = await fetch(`https://partner.shopeemobile.com${path}?${params.toString()}`, {
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
