// TikTok Shop integration
// Two strategies:
//   A) TikTok Shop Partner API (requires partner approval) — primary
//   B) Browser cookie import + order scraping — fallback
// The auth_data.isCookie flag determines which strategy to use.

import { PlatformRow } from '../db/repositories/platform-repo';

interface TikTokOrder {
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

// ---- Strategy A: Partner API ----

const TIKTOK_API_BASE = 'https://open-api.tiktokglobalshop.com';

async function syncViaPartnerApi(auth: any): Promise<TikTokOrder[]> {
  if (!auth.accessToken || !auth.shopCipher) {
    throw new Error('TikTok Partner API requires accessToken and shopCipher');
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const res = await fetch(`${TIKTOK_API_BASE}/api/orders/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tts-access-token': auth.accessToken,
    },
    body: JSON.stringify({
      shop_cipher: auth.shopCipher,
      page_size: 50,
      create_time_from: Math.floor(yesterday.getTime() / 1000),
      create_time_to: Math.floor(now.getTime() / 1000),
    }),
  });
  const data = await res.json() as any;
  if (data.code !== 0) throw new Error(`TikTok API error: ${data.code} - ${data.message}`);

  return (data.data?.orders || []).map((o: any) => {
    const item = o.package_list?.[0]?.item_list?.[0] || {};
    const addr = o.recipient_address || {};
    return {
      platform_order_id: o.id || o.order_id || '',
      sku: item.seller_sku || item.sku_id || '',
      quantity: item.quantity || 1,
      unit_price: parseFloat(item.sale_price || '0'),
      currency: o.currency || 'USD',
      total_amount: parseFloat(o.payment?.total_amount || o.total_amount || '0'),
      buyer_name: addr.name || o.buyer_name || null,
      shipping_address: addr.full_address
        || [addr.region, addr.city, addr.district, addr.detail_address].filter(Boolean).join(', ')
        || null,
      status: mapTikTokStatus(o.status),
      platform_status: o.status || '',
      order_time: o.create_time ? new Date(o.create_time * 1000).toISOString() : new Date().toISOString(),
    } as TikTokOrder;
  });
}

// ---- Strategy B: Cookie-based scraping ----

const TIKTOK_SELLER_URLS: Record<string, string> = {
  us: 'https://seller-us.tiktok.com',
  uk: 'https://seller-uk.tiktok.com',
  sg: 'https://seller-sg.tiktok.com',
  th: 'https://seller-th.tiktok.com',
  vn: 'https://seller-vn.tiktok.com',
  ph: 'https://seller-ph.tiktok.com',
  my: 'https://seller-my.tiktok.com',
  id: 'https://seller-id.tiktok.com',
};

async function syncViaCookie(_auth: any): Promise<TikTokOrder[]> {
  // Cookie-based scraping requires the in-app browser to capture cookies.
  // Store the captured cookies in auth.cookies (JSON string) and site in auth.site.
  // The actual fetch uses the captured session cookies to access the seller center API.

  const site = _auth.site || 'us';
  const baseUrl = TIKTOK_SELLER_URLS[site] || TIKTOK_SELLER_URLS.us;
  let cookies: string;
  try {
    cookies = typeof _auth.cookies === 'string' ? _auth.cookies : JSON.stringify(_auth.cookies || {});
  } catch {
    cookies = '';
  }

  if (!cookies || cookies === '{}') {
    return []; // No cookies available — user needs to log in via in-app browser first
  }

  // Try to access the seller center's internal order API
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/order/list?page_size=50&create_time_from=${Math.floor(Date.now() / 1000) - 86400}`,
      {
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    );
    if (res.status === 401 || res.status === 403) {
      console.warn('TikTok cookie expired — please re-login via in-app browser');
      return [];
    }
    const data = await res.json() as any;
    if (!data.data?.list) return [];

    return data.data.list.map((o: any) => ({
      platform_order_id: o.order_id || o.id || '',
      sku: o.items?.[0]?.seller_sku || '',
      quantity: o.items?.[0]?.quantity || 1,
      unit_price: parseFloat(o.items?.[0]?.price || '0'),
      currency: 'USD',
      total_amount: parseFloat(o.total_amount || '0'),
      buyer_name: o.buyer_name || null,
      shipping_address: o.shipping_address || null,
      status: mapTikTokStatus(o.status),
      platform_status: o.status || '',
      order_time: o.create_time ? new Date(o.create_time * 1000).toISOString() : new Date().toISOString(),
    }));
  } catch (err: any) {
    console.warn(`TikTok cookie scraping failed: ${err.message}`);
    return [];
  }
}

// ---- Public API ----

export async function syncTikTokOrders(platform: PlatformRow): Promise<{ orders: TikTokOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth) {
    return { orders: [], message: 'TikTok Shop credentials not configured' };
  }

  // Determine strategy based on auth data
  if (auth.accessToken && auth.shopCipher) {
    try {
      const orders = await syncViaPartnerApi(auth);
      return { orders, message: `Synced ${orders.length} orders via Partner API` };
    } catch (err: any) {
      console.warn(`TikTok Partner API failed: ${err.message}, trying cookie fallback...`);
      const orders = await syncViaCookie(auth);
      return {
        orders,
        message: orders.length > 0
          ? `Synced ${orders.length} orders via cookie (Partner API failed: ${err.message})`
          : `Both Partner API and cookie sync failed. Please check credentials or re-login.`,
      };
    }
  }

  // No API creds — try cookie scraping
  if (auth.cookies) {
    const orders = await syncViaCookie(auth);
    return {
      orders,
      message: orders.length > 0
        ? `Synced ${orders.length} orders via cookie`
        : 'No orders found via cookie. The cookie may have expired.',
    };
  }

  // Neither API nor cookie available — guide the user
  return {
    orders: [],
    message: 'TikTok Shop requires either Partner API credentials (accessToken + shopCipher) '
      + 'or in-app browser cookie capture. Configure in Settings → TikTok Shop → 配置授权.',
  };
}

function mapTikTokStatus(status: string): string {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    'unpaid': 'pending', 'awaiting_payment': 'pending',
    'awaiting_shipment': 'matched', 'ready_to_ship': 'matched',
    'shipped': 'shipped', 'in_transit': 'shipped', 'partially_shipped': 'matched',
    'delivered': 'delivered', 'completed': 'delivered',
    'cancelled': 'cancelled', 'returned': 'refunding',
  };
  return map[s] || 'pending';
}
