import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';
import type { Warehouse } from '../types/inventory';

interface WarehouseState {
  warehouses: Warehouse[]; loading: boolean; error: string | null;
  loadWarehouses: () => Promise<void>;
  createWarehouse: (name: string, type: string, country: string) => Promise<void>;
  updateWarehouse: (id: string, fields: { name?: string; country?: string }) => Promise<void>;
  deleteWarehouse: (id: string) => Promise<void>;
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  warehouses: [], loading: false, error: null,

  loadWarehouses: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ warehouses: await api.invoke(IPC.WAREHOUSE_LIST) || [], loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load warehouses' }); }
  },

  createWarehouse: async (name, type, country) => { const api = getApi(); if (!api) return; await api.invoke(IPC.WAREHOUSE_CREATE, name, type, country); get().loadWarehouses(); },
  updateWarehouse: async (id, fields) => { const api = getApi(); if (!api) return; await api.invoke(IPC.WAREHOUSE_UPDATE, id, fields); get().loadWarehouses(); },
  deleteWarehouse: async (id) => { const api = getApi(); if (!api) return; await api.invoke(IPC.WAREHOUSE_DELETE, id); get().loadWarehouses(); },
}));
