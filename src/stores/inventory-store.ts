import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';
import type { InventoryItem } from '../types/inventory';

interface InventoryState {
  items: InventoryItem[]; lowStock: InventoryItem[];
  loading: boolean; error: string | null;
  loadAll: () => Promise<void>;
  loadLowStock: () => Promise<void>;
  restock: (productId: string, warehouseId: string, quantity: number, note?: string) => Promise<void>;
  receiveRestock: (productId: string, warehouseId: string, quantity: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [], lowStock: [], loading: false, error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron' }); return; }
    try {
      const items = await api.invoke(IPC.INVENTORY_LIST);
      set({ items, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to load inventory' });
    }
  },

  loadLowStock: async () => {
    const api = getApi(); if (!api) return;
    try { set({ lowStock: await api.invoke(IPC.INVENTORY_LOW_STOCK) || [] }); } catch { /* silent */ }
  },

  restock: async (productId, warehouseId, quantity, note) => {
    const api = getApi(); if (!api) return;
    await api.invoke(IPC.INVENTORY_RESTOCK, productId, warehouseId, quantity, note);
    get().loadAll(); get().loadLowStock();
  },

  receiveRestock: async (productId, warehouseId, quantity) => {
    const api = getApi(); if (!api) return;
    await api.invoke(IPC.INVENTORY_RECEIVE, productId, warehouseId, quantity);
    get().loadAll(); get().loadLowStock();
  },
}));
