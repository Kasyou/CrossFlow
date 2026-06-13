import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';
import type { Product } from '../types/product';

interface ProductState {
  products: Product[]; loading: boolean; error: string | null;
  loadProducts: () => Promise<void>;
  createProduct: (data: any) => Promise<void>;
  updateProduct: (sku: string, data: any) => Promise<void>;
  deleteProduct: (sku: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [], loading: false, error: null,

  loadProducts: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ products: await api.invoke(IPC.PRODUCT_LIST) || [], loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load products' }); }
  },

  createProduct: async (data) => { const api = getApi(); if (!api) return; await api.invoke(IPC.PRODUCT_CREATE, data); get().loadProducts(); },
  updateProduct: async (sku, data) => { const api = getApi(); if (!api) return; await api.invoke(IPC.PRODUCT_UPDATE, sku, data); get().loadProducts(); },
  deleteProduct: async (sku) => { const api = getApi(); if (!api) return; await api.invoke(IPC.PRODUCT_DELETE, sku); get().loadProducts(); },
}));
