import { create } from 'zustand';

function api() { return (window as any).electronAPI; }

interface Supplier { id: string; name: string; contact: string | null; email: string | null; phone: string | null; lead_time_days: number; moq: number; payment_terms: string | null; notes: string | null; }
interface PO { id: string; supplier_name: string; status: string; total_amount: number; item_count: number; created_at: string; }

interface ProcurementState {
  suppliers: Supplier[];
  purchaseOrders: PO[];
  loading: boolean;
  loadSuppliers: () => Promise<void>;
  loadPOs: () => Promise<void>;
  createSupplier: (d: any) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  createPO: (supplierId: string, items: any[]) => Promise<void>;
  updatePOStatus: (id: string, status: string) => Promise<void>;
}

export const useProcurementStore = create<ProcurementState>((set, get) => ({
  suppliers: [], purchaseOrders: [], loading: false,
  loadSuppliers: async () => { const a = api(); if (!a) return; set({ loading: true }); set({ suppliers: await a.invoke('supplier:list') || [], loading: false }); },
  loadPOs: async () => { const a = api(); if (!a) return; set({ purchaseOrders: await a.invoke('po:list') || [] }); },
  createSupplier: async (d) => { const a = api(); if (!a) return; await a.invoke('supplier:create', d); get().loadSuppliers(); },
  deleteSupplier: async (id) => { const a = api(); if (!a) return; await a.invoke('supplier:delete', id); get().loadSuppliers(); },
  createPO: async (sId, items) => { const a = api(); if (!a) return; await a.invoke('po:create', sId, items); get().loadPOs(); },
  updatePOStatus: async (id, s) => { const a = api(); if (!a) return; await a.invoke('po:updateStatus', id, s); get().loadPOs(); },
}));
