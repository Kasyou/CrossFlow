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

export async function syncAmazonOrders(platform: PlatformRow): Promise<{ orders: AmazonOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.refreshToken || !auth.clientId || !auth.clientSecret) {
    return { orders: [], message: 'Amazon SP-API credentials not configured' };
  }

  const accessToken = await getAccessToken(auth);
  const orders = await fetchOrders(accessToken, auth.region || 'na');

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

async function fetchOrders(accessToken: string, region: string): Promise<AmazonOrder[]> {
  const baseUrl = region === 'eu' ? 'https://sellingpartnerapi-eu.amazon.com' : 'https://sellingpartnerapi-na.amazon.com';
  const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${baseUrl}/orders/v0/orders?MarketplaceIds=ATVPDKIKX0DER&CreatedAfter=${createdAfter}&OrderStatuses=Unshipped&OrderStatuses=PartiallyShipped`, {
    headers: { 'x-amz-access-token': accessToken },
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(`Amazon API error: ${JSON.stringify(data)}`);

  const orders = data.payload?.Orders || [];
  return orders.map((o: any) => ({
    platform_order_id: o.AmazonOrderId,
    sku: '',
    quantity: o.NumberOfItemsUnshipped || 1,
    unit_price: o.OrderTotal?.Amount || 0,
    currency: o.OrderTotal?.CurrencyCode || 'USD',
    total_amount: o.OrderTotal?.Amount || 0,
    buyer_name: o.BuyerName || null,
    shipping_address: o.ShippingAddress ? JSON.stringify(o.ShippingAddress) : null,
    status: mapOrderStatus(o.OrderStatus),
    platform_status: o.OrderStatus,
    order_time: o.PurchaseDate,
  }));
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
