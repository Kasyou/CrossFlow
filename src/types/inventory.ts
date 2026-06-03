export interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  sku: string;
  product_name: string;
  warehouse_name: string;
  warehouse_type: 'domestic' | 'fba' | 'overseas';
  available: number;
  reserved: number;
  in_transit: number;
  safety_stock: number;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: 'domestic' | 'fba' | 'overseas';
  country: string | null;
  isDefault: boolean;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  warehouse_id: string;
  change_type: 'order_reserve' | 'order_release' | 'restock' | 'adjust' | 'return';
  quantity: number;
  available_after: number;
  reserved_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}
