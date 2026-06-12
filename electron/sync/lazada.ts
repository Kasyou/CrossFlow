// Lazada Open Platform API v2
// Reference: https://open.lazada.com/doc/api

import { createHmac } from 'crypto';
import { PlatformRow } from '../db/repositories/platform-repo';

interface LazadaOrder {
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

const LAZADA_ENDPOINTS: Record<string, string> = {
  sg: 'https://api.lazada.sg/rest',
  my: 'https://api.lazada.com.my/rest',
  th: 'https://api.lazada.co.th/rest',
  id: 'https://api.lazada.co.id/rest',
  vn: 'https://api.lazada.vn/rest',
  ph: 'https://api.lazada.com.ph/rest',
};

function signLazadaRequest(
  apiPath: string, params: Record<string, string>, body: string, appSecret: string,
): string {
  const sortedKeys = Object.keys(params).sort();
  const concat = apiPath + sortedKeys.map(k => `${k}${params[k]}`).join('') + body;
  return createHmac('sha256', appSecret).update(concat).digest('hex').toUpperCase();
}

export async function syncLazadaOrders(platform: PlatformRow): Promise<{ orders: LazadaOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.appKey || !auth.appSecret || !auth.accessToken) {
    return { orders: [], message: 'Lazada credentials not configured (appKey, appSecret, accessToken required)' };
  }

  const site = auth.site || 'sg';
  const baseUrl = LAZADA_ENDPOINTS[site] || LAZADA_ENDPOINTS.sg;
  const appKey = String(auth.appKey);
  const appSecret = String(auth.appSecret);
  const accessToken = String(auth.accessToken);

  // Step 1: Get order list (last 24 hours)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const apiPath = '/orders/get';
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: now.toISOString().replace(/\.\d{3}Z$/, '+0800'),
    sign_method: 'sha256',
    access_token: accessToken,
    created_after: yesterday.toISOString().replace(/\.\d{3}Z$/, '+0800'),
    status: 'pending,ready_to_ship,shipped',
    limit: '100',
    offset: '0',
  };
  params.sign = signLazadaRequest(apiPath, params, '', appSecret);

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const listRes = await fetch(`${baseUrl}${apiPath}?${queryString}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const listData = await listRes.json() as any;
  if (listData.code !== '0') {
    throw new Error(`Lazada API error: ${listData.code} - ${listData.message || listData.type}`);
  }

  const orderList: any[] = listData.data?.orders || [];

  // Step 2: Fetch order items for SKU detail
  const enriched = await Promise.all(
    orderList.map(async (o: any) => {
      const items = await fetchLazadaOrderItems(baseUrl, appKey, appSecret, accessToken, o.order_id);
      const primaryItem = items[0] || {};
      return {
        platform_order_id: String(o.order_id),
        sku: primaryItem.sku || primaryItem.seller_sku || '',
        quantity: primaryItem.quantity || 1,
        unit_price: parseFloat(String(primaryItem.item_price || primaryItem.paid_price || o.price || '0')),
        currency: o.currency || 'USD',
        total_amount: parseFloat(String(o.price || '0')),
        buyer_name: o.customer_first_name
          ? `${o.customer_first_name} ${o.customer_last_name || ''}`.trim()
          : null,
        shipping_address: o.address_shipping
          ? [o.address_shipping?.address, o.address_shipping?.city, o.address_shipping?.country]
            .filter(Boolean).join(', ')
          : null,
        status: mapLazadaStatus(o.statuses?.[0] || o.status),
        platform_status: o.statuses?.[0] || o.status || '',
        order_time: o.created_at || now.toISOString(),
      } as LazadaOrder;
    }),
  );

  return { orders: enriched };
}

async function fetchLazadaOrderItems(
  baseUrl: string, appKey: string, appSecret: string, accessToken: string, orderId: number,
): Promise<any[]> {
  const apiPath = '/order/items/get';
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+0800'),
    sign_method: 'sha256',
    access_token: accessToken,
    order_id: String(orderId),
  };
  params.sign = signLazadaRequest(apiPath, params, '', appSecret);

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  try {
    const res = await fetch(`${baseUrl}${apiPath}?${queryString}`);
    const data = await res.json() as any;
    if (data.code !== '0') {
      console.warn(`Failed to fetch items for Lazada order ${orderId}: ${data.message || data.type}`);
      return [];
    }
    return data.data || [];
  } catch (err: any) {
    console.warn(`Error fetching items for Lazada order ${orderId}: ${err.message}`);
    return [];
  }
}

function mapLazadaStatus(status: string): string {
  // Lazada statuses: pending, ready_to_ship, shipped, delivered, returned, cancelled, failed
  const map: Record<string, string> = {
    'pending': 'pending', 'unpaid': 'pending',
    'ready_to_ship': 'matched', 'processing': 'matched',
    'shipped': 'shipped', 'in_transit': 'shipped',
    'delivered': 'delivered', 'received': 'delivered',
    'returned': 'refunding', 'cancelled': 'cancelled', 'failed': 'cancelled',
  };
  return map[status.toLowerCase()] || 'pending';
}
