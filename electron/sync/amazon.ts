import { PlatformRow } from '../db/repositories/platform-repo';
import { rateLimitedFetch } from './rate-limiter';

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
  _items?: { sku: string; quantity: number; unit_price: number; currency: string }[];
}

export async function syncAmazonOrders(platform: PlatformRow): Promise<{ orders: AmazonOrder[]; message?: string }> {
  const auth = platform.auth_data ? JSON.parse(platform.auth_data) : null;
  if (!auth || !auth.refreshToken || !auth.clientId || !auth.clientSecret) {
    return { orders: [], message: 'Amazon SP-API credentials not configured' };
  }

  const accessToken = await getAccessToken(auth);
  const orders = await fetchOrders(accessToken, auth.region || 'na', auth.marketplaceId);

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

const SP_API_ENDPOINTS: Record<string, string> = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com',
};

const MARKETPLACE_IDS: Record<string, string> = {
  na: 'ATVPDKIKX0DER',       // US
  ca: 'A2EUQ1WTGCTBG2',      // Canada
  mx: 'A1AM78C64UM0Y8',      // Mexico
  uk: 'A1F83G8C2ARO7P',      // UK
  de: 'A1PA6795UKMFR9',      // Germany
  fr: 'A13V1IB3VIYZZH',      // France
  it: 'APJ6JRA9NG5V4',       // Italy
  es: 'A1RKKUPIHCS9HS',      // Spain
  jp: 'A1VC38T7YXB528',      // Japan
  au: 'A39IBJ37TRP1C6',      // Australia
};

function getSpApiEndpoint(region: string): string {
  if (region === 'na' || region === 'ca' || region === 'mx') return SP_API_ENDPOINTS.na;
  if (region === 'jp' || region === 'au') return SP_API_ENDPOINTS.fe;
  return SP_API_ENDPOINTS.eu;
}

async function fetchOrders(accessToken: string, region: string, marketplaceId?: string): Promise<AmazonOrder[]> {
  const baseUrl = getSpApiEndpoint(region);
  const mktId = marketplaceId || MARKETPLACE_IDS[region] || MARKETPLACE_IDS.na;
  const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let allOrders: any[] = [];
  let nextToken: string | undefined;
  do {
    const url = `${baseUrl}/orders/v0/orders?MarketplaceIds=${mktId}&CreatedAfter=${createdAfter}&OrderStatuses=Unshipped&OrderStatuses=PartiallyShipped${nextToken ? `&NextToken=${nextToken}` : ''}`;
    const res = await rateLimitedFetch('amazon', 5, 1, url, { headers: { 'x-amz-access-token': accessToken } });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`Amazon API error: ${JSON.stringify(data)}`);
    allOrders.push(...(data.payload?.Orders || []));
    nextToken = data.payload?.NextToken;
  } while (nextToken);

  const orders = allOrders;

  // Fetch order items for each order to get real SKUs
  const enriched = await Promise.all(
    orders.map(async (o: any) => {
      const items = await fetchOrderItems(baseUrl, accessToken, o.AmazonOrderId);
      const primaryItem = items[0] || {};
      const allItems: AmazonOrder['_items'] = items.map((item: any) => ({
        sku: item.SellerSKU || item.ASIN || '',
        quantity: item.QuantityOrdered || 1,
        unit_price: parseFloat(item.ItemPrice?.Amount || '0'),
        currency: item.ItemPrice?.CurrencyCode || o.OrderTotal?.CurrencyCode || 'USD',
      }));
      return {
        platform_order_id: o.AmazonOrderId,
        sku: primaryItem.SellerSKU || primaryItem.ASIN || '',
        quantity: primaryItem.QuantityOrdered || o.NumberOfItemsUnshipped || 1,
        unit_price: parseFloat(primaryItem.ItemPrice?.Amount || o.OrderTotal?.Amount || '0'),
        currency: primaryItem.ItemPrice?.CurrencyCode || o.OrderTotal?.CurrencyCode || 'USD',
        total_amount: parseFloat(o.OrderTotal?.Amount || '0'),
        buyer_name: o.BuyerName || null,
        shipping_address: o.ShippingAddress ? JSON.stringify(o.ShippingAddress) : null,
        status: mapOrderStatus(o.OrderStatus),
        platform_status: o.OrderStatus,
        order_time: o.PurchaseDate,
        _items: allItems.length > 1 ? allItems : undefined,
      } as AmazonOrder;
    }),
  );

  return enriched;
}

async function fetchOrderItems(baseUrl: string, accessToken: string, orderId: string): Promise<any[]> {
  try {
    const res = await rateLimitedFetch('amazon', 5, 1,
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
