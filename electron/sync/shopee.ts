import { createHmac } from 'crypto';
import { PlatformRow } from '../db/repositories/platform-repo';

interface ShopeeOrderItemDetail { item_sku: string; model_sku: string; model_quantity_purchased: number; model_original_price: string | number; }

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
  _items?: { sku: string; quantity: number; unit_price: number; currency: string }[];
}

interface ShopeeOrderItem {
  item_sku: string;
  model_sku: string;
  model_quantity_purchased: number;
  model_original_price: number;
}

function signShopeeRequest(path: string, params: Record<string, string>, partnerKey: string): string {
  if (!partnerKey || typeof partnerKey !== 'string') {
    throw new Error('Shopee partnerKey must be a non-empty string for HMAC signing');
  }
  const sortedKeys = Object.keys(params).sort();
  const baseString = path + '|' + sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const signature = createHmac('sha256', partnerKey).update(baseString).digest('hex');
  if (!signature) throw new Error('Shopee HMAC signature computation failed');
  return signature;
}

function buildSignedUrl(host: string, path: string, params: Record<string, string>, partnerKey: string): string {
  const sign = signShopeeRequest(path, params, partnerKey);
  const allParams = { ...params, sign };
  const query = new URLSearchParams(allParams).toString();
  return `${host}${path}?${query}`;
}

export async function syncShopeeOrders(platform: PlatformRow): Promise<{ orders: ShopeeOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.partnerId || !auth.partnerKey || !auth.shopId) {
    return { orders: [], message: 'Shopee credentials not configured' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const site = auth.site || 'sg';
  const host = getShopeeHost(site);
  const baseParams: Record<string, string> = {
    partner_id: String(auth.partnerId),
    timestamp: String(timestamp),
    shop_id: String(auth.shopId),
    time_range_field: 'create_time',
    time_from: String(timestamp - 86400),
    time_to: String(timestamp),
    page_size: '100',
  };

  // Step 1: get order list
  const listUrl = buildSignedUrl(host, '/api/v2/order/get_order_list', baseParams, String(auth.partnerKey));
  const listRes = await fetch(listUrl, { headers: { 'Content-Type': 'application/json' } });
  const listData = await listRes.json() as any;
  if (listData.error) throw new Error(`Shopee API error: ${listData.error} - ${listData.message}`);

  const orderList = listData.response?.order_list || [];
  const partnerKey = String(auth.partnerKey);
  const partnerId = String(auth.partnerId);
  const shopId = String(auth.shopId);

  // Step 2: fetch detail for each order to get real SKUs
  const enriched = await Promise.all(
    orderList.map(async (o: any) => {
      const items = await fetchOrderDetail(host, partnerId, partnerKey, shopId, o.order_sn, timestamp);
      const primaryItem = items[0] || ({} as ShopeeOrderItemDetail);
      const allItems: ShopeeOrder['_items'] = items.map((item: ShopeeOrderItemDetail) => ({
        sku: item.item_sku || item.model_sku || '',
        quantity: item.model_quantity_purchased || 1,
        unit_price: parseFloat(String(item.model_original_price || '0')),
        currency: o.currency || 'USD',
      }));
      return {
        platform_order_id: o.order_sn,
        sku: primaryItem.item_sku || primaryItem.model_sku || '',
        quantity: primaryItem.model_quantity_purchased || 1,
        unit_price: parseFloat(String(primaryItem.model_original_price || o.total_amount || '0')),
        currency: o.currency || 'USD',
        total_amount: parseFloat(o.total_amount || '0'),
        buyer_name: null,
        shipping_address: null,
        status: mapShopeeStatus(o.order_status),
        platform_status: o.order_status,
        order_time: new Date(o.create_time * 1000).toISOString(),
        _items: allItems.length > 1 ? allItems : undefined,
      } as ShopeeOrder;
    }),
  );

  return { orders: enriched };
}

async function fetchOrderDetail(
  host: string, partnerId: string, partnerKey: string, shopId: string,
  orderSn: string, _timestamp: number,
): Promise<ShopeeOrderItem[]> {
  const ts = Math.floor(Date.now() / 1000);
  const detailParams: Record<string, string> = {
    partner_id: partnerId,
    timestamp: String(ts),
    shop_id: shopId,
    order_sn_list: orderSn,
    response_optional_fields: 'item_list',
  };
  try {
    const detailUrl = buildSignedUrl(host, '/api/v2/order/get_order_detail', detailParams, partnerKey);
    const res = await fetch(detailUrl, { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json() as any;
    if (data.error) {
      console.warn(`Failed to fetch detail for order ${orderSn}: ${data.error} - ${data.message}`);
      return [];
    }
    const detailList = data.response?.order_list || [];
    const detail = detailList[0];
    if (!detail) return [];
    return (detail.item_list || []).map((item: any) => ({
      item_sku: item.item_sku || '',
      model_sku: item.model_sku || '',
      model_quantity_purchased: item.model_quantity_purchased || 1,
      model_original_price: parseFloat(String(item.model_original_price || '0')),
    }));
  } catch (err: any) {
    console.warn(`Error fetching detail for order ${orderSn}: ${err.message}`);
    return [];
  }
}

const SHOPEE_HOSTS: Record<string, string> = {
  sg: 'https://partner.shopeemobile.com',
  my: 'https://partner.shopeemobile.com.my',
  th: 'https://partner.shopeemobile.co.th',
  tw: 'https://partner.shopeemobile.com',
  id: 'https://partner.shopeemobile.co.id',
  vn: 'https://partner.shopeemobile.vn',
  ph: 'https://partner.shopeemobile.ph',
  br: 'https://partner.shopeemobile.com.br',
  mx: 'https://partner.shopeemobile.mx',
};

function getShopeeHost(site: string): string {
  return SHOPEE_HOSTS[site] || SHOPEE_HOSTS.sg;
}

function mapShopeeStatus(status: string): string {
  const map: Record<string, string> = {
    'UNPAID': 'pending', 'READY_TO_SHIP': 'matched', 'PROCESSED': 'matched',
    'SHIPPED': 'shipped', 'COMPLETED': 'delivered', 'CANCELLED': 'cancelled', 'IN_CANCEL': 'refunding',
  };
  return map[status] || 'pending';
}
