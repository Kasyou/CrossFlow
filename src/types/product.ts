export interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn: string | null;
  imageUrl: string | null;
  category: string | null;
  costPrice: number;
  weightKg: number;
  safetyStock: number;
  createdAt: string;
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
