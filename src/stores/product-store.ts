import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { Product } from '../types/product';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) { console.warn('electronAPI not available'); return null; }
  return api;
}

interface ProductState {
  products: Product[];
  loading: boolean;
  loadProducts: () => Promise<void>;
  createProduct: (data: any) => Promise<void>;
  updateProduct: (sku: string, data: any) => Promise<void>;
  deleteProduct: (sku: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,

  loadProducts: async () => {
    const api = getApi();
    if (!api) return;
    set({ loading: true });
    const products = await api.invoke(IPC.PRODUCT_LIST);
    set({ products, loading: false });
  },

  createProduct: async (data) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.PRODUCT_CREATE, data);
    get().loadProducts();
  },

  updateProduct: async (sku, data) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.PRODUCT_UPDATE, sku, data);
    get().loadProducts();
  },

  deleteProduct: async (sku) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.PRODUCT_DELETE, sku);
    get().loadProducts();
  },
}));
