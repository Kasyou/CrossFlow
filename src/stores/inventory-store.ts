import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { InventoryItem, Warehouse } from '../types/inventory';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api;
}

interface InventoryState {
  items: InventoryItem[];
  lowStock: InventoryItem[];
  warehouses: Warehouse[];
  loading: boolean;
  loadAll: () => Promise<void>;
  loadLowStock: () => Promise<void>;
  loadWarehouses: () => Promise<void>;
  restock: (productId: string, warehouseId: string, quantity: number, note?: string) => Promise<void>;
  receiveRestock: (productId: string, warehouseId: string, quantity: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  lowStock: [],
  warehouses: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const api = getApi();
    if (!api) { set({ loading: false }); return; }
    const items = await api.invoke(IPC.INVENTORY_LIST);
    set({ items, loading: false });
  },

  loadLowStock: async () => {
    const api = getApi();
    if (!api) return;
    const lowStock = await api.invoke(IPC.INVENTORY_LOW_STOCK);
    set({ lowStock });
  },

  loadWarehouses: async () => {
    const api = getApi();
    if (!api) return;
    const warehouses = await api.invoke(IPC.WAREHOUSE_LIST);
    set({ warehouses });
  },

  restock: async (productId, warehouseId, quantity, note) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.INVENTORY_RESTOCK, productId, warehouseId, quantity, note);
    get().loadAll();
    get().loadLowStock();
  },

  receiveRestock: async (productId, warehouseId, quantity) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.INVENTORY_RECEIVE, productId, warehouseId, quantity);
    get().loadAll();
    get().loadLowStock();
  },
}));
