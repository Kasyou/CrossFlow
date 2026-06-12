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

// Token-bucket rate limiter for SP-API (burst 5, refill 1/second)
let tokenBucket = { tokens: 5, lastRefill: Date.now() };
function rateLimitedFetch(url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      const now = Date.now();
      const refill = Math.floor((now - tokenBucket.lastRefill) / 1000);
      tokenBucket.tokens = Math.min(5, tokenBucket.tokens + refill);
      tokenBucket.lastRefill = now;

      if (tokenBucket.tokens > 0) {
        tokenBucket.tokens--;
        try {
          const res = await fetch(url, init);
          if (res.status === 429) {
            tokenBucket.tokens = 0;
            setTimeout(tryFetch, 2000);
            return;
          }
          resolve(res);
        } catch (e) {
          reject(e);
        }
      } else {
        setTimeout(tryFetch, 1000);
      }
    };
    tryFetch();
  });
}

export async function syncAmazonOrders(platform: PlatformRow): Promise<{ orders: AmazonOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.refreshToken || !auth.clientId || !auth.clientSecret) {
    return { orders: [], message: 'Amazon SP-API credentials not configured' };
  }

  const accessToken = await getAccessToken(auth);
  const orders = await fetchOrders(accessToken, auth.region || 'na', accessToken);

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

async function fetchOrders(accessToken: string, region: string, _authToken: string): Promise<AmazonOrder[]> {
  const baseUrl = region === 'eu' ? 'https://sellingpartnerapi-eu.amazon.com' : 'https://sellingpartnerapi-na.amazon.com';
  const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const res = await rateLimitedFetch(
    `${baseUrl}/orders/v0/orders?MarketplaceIds=ATVPDKIKX0DER&CreatedAfter=${createdAfter}&OrderStatuses=Unshipped&OrderStatuses=PartiallyShipped`,
    { headers: { 'x-amz-access-token': accessToken } },
  );
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`Amazon API error: ${JSON.stringify(data)}`);

  const orders = data.payload?.Orders || [];

  // Fetch order items for each order to get real SKUs
  const enriched = await Promise.all(
    orders.map(async (o: any) => {
      const items = await fetchOrderItems(baseUrl, accessToken, o.AmazonOrderId);
      const primaryItem = items[0] || {};
      return {
        platform_order_id: o.AmazonOrderId,
        sku: primaryItem.SellerSKU || primaryItem.ASIN || '',
        quantity: primaryItem.QuantityOrdered || o.NumberOfItemsUnshipped || 1,
        unit_price: parseFloat(primaryItem.ItemPrice?.Amount || o.OrderTotal?.Amount || '0'),
        currency: primaryItem.ItemPrice?.CurrencyCode || o.OrderTotal?.CurrencyCode || 'USD',
        total_amount: parseFloat(primaryItem.ItemPrice?.Amount || o.OrderTotal?.Amount || '0'),
        buyer_name: o.BuyerName || null,
        shipping_address: o.ShippingAddress ? JSON.stringify(o.ShippingAddress) : null,
        status: mapOrderStatus(o.OrderStatus),
        platform_status: o.OrderStatus,
        order_time: o.PurchaseDate,
      } as AmazonOrder;
    }),
  );

  return enriched;
}

async function fetchOrderItems(baseUrl: string, accessToken: string, orderId: string): Promise<any[]> {
  try {
    const res = await rateLimitedFetch(
      `${baseUrl}/orders/v0/orders/${orderId}/orderItems`,
      { headers: { 'x-amz-access-token': accessToken } },
    );
    const data = await res.json() as any;
    if (!res.ok) {
      console.warn(`Failed to fetch items for order ${orderId}: ${JSON.stringify(data)}`);
      return [];
    }
    return data.payload?.OrderItems || [];
  } catch (err: any) {
    console.warn(`Error fetching items for order ${orderId}: ${err.message}`);
    return [];
  }
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
