import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';

interface Supplier { id: string; name: string; contact: string | null; email: string | null; phone: string | null; lead_time_days: number; moq: number; payment_terms: string | null; notes: string | null; }
interface PO { id: string; supplier_name: string; status: string; total_amount: number; item_count: number; created_at: string; }

interface ProcurementState {
  suppliers: Supplier[]; purchaseOrders: PO[];
  loading: boolean; error: string | null;
  loadSuppliers: () => Promise<void>; loadPOs: () => Promise<void>;
  createSupplier: (d: any) => Promise<void>; deleteSupplier: (id: string) => Promise<void>;
  createPO: (supplierId: string, items: any[]) => Promise<void>;
  updatePOStatus: (id: string, status: string) => Promise<void>;
}

export const useProcurementStore = create<ProcurementState>((set, get) => ({
  suppliers: [], purchaseOrders: [], loading: false, error: null,

  loadSuppliers: async () => {
    set({ loading: true, error: null });
    const a = getApi(); if (!a) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ suppliers: await a.invoke(IPC.SUPPLIER_LIST) || [], loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load suppliers' }); }
  },

  loadPOs: async () => {
    const a = getApi(); if (!a) return;
    try { set({ purchaseOrders: await a.invoke(IPC.PO_LIST) || [] }); } catch { /* silent */ }
  },

  createSupplier: async (d) => { const a = getApi(); if (!a) return; await a.invoke(IPC.SUPPLIER_CREATE, d); get().loadSuppliers(); },
  deleteSupplier: async (id) => { const a = getApi(); if (!a) return; await a.invoke(IPC.SUPPLIER_DELETE, id); get().loadSuppliers(); },
  createPO: async (sId, items) => { const a = getApi(); if (!a) return; await a.invoke(IPC.PO_CREATE, sId, items); get().loadPOs(); },
  updatePOStatus: async (id, s) => { const a = getApi(); if (!a) return; await a.invoke(IPC.PO_UPDATE_STATUS, id, s); get().loadPOs(); },
}));
