import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { Warehouse } from '../types/inventory';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api;
}

interface WarehouseState {
  warehouses: Warehouse[];
  loading: boolean;
  loadWarehouses: () => Promise<void>;
  createWarehouse: (name: string, type: string, country: string) => Promise<void>;
  updateWarehouse: (id: string, fields: { name?: string; country?: string }) => Promise<void>;
  deleteWarehouse: (id: string) => Promise<void>;
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  warehouses: [],
  loading: false,

  loadWarehouses: async () => {
    set({ loading: true });
    const api = getApi();
    if (!api) { set({ loading: false }); return; }
    const warehouses = await api.invoke(IPC.WAREHOUSE_LIST);
    set({ warehouses, loading: false });
  },

  createWarehouse: async (name, type, country) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.WAREHOUSE_CREATE, name, type, country);
    get().loadWarehouses();
  },

  updateWarehouse: async (id, fields) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.WAREHOUSE_UPDATE, id, fields);
    get().loadWarehouses();
  },

  deleteWarehouse: async (id) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.WAREHOUSE_DELETE, id);
    get().loadWarehouses();
  },
}));
