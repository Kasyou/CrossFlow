export type OrderStatus = 'pending' | 'matched' | 'shipped' | 'delivered' | 'refunding' | 'refunded' | 'cancelled';

export interface Order {
  id: string;
  platform_id: string;
  platform_name: string;
  platform_order_id: string;
  product_id: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  currency: string;
  total_amount: number;
  buyer_name: string | null;
  shipping_address: string | null;
  logistics_provider: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  platform_status: string | null;
  order_time: string | null;
  shipped_time: string | null;
  synced_at: string;
}

export interface OrderFilter {
  status?: string;
  platformId?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
