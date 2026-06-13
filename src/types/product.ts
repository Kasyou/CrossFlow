export interface Product {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  nameEn?: string | null;
  image_url: string | null;
  category: string | null;
  cost_price: number;
  costPrice?: number;
  weight_kg: number;
  weightKg?: number;
  safety_stock: number;
  safetyStock?: number;
  created_at: string;
}

export interface ProductPlatform {
  id: string;
  productId: string;
  platformId: string;
  platformSku: string | null;
  platformPid: string | null;
  sellingPrice: number;
  currency: string;
  status: 'active' | 'paused' | 'deleted';
}
