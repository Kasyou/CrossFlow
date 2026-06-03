import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { Order, OrderFilter } from '../types/order';

interface OrderState {
  orders: Order[];
  total: number;
  loading: boolean;
  pendingCount: number;
  filter: OrderFilter;
  selectedRowKeys: string[];

  loadOrders: () => Promise<void>;
  setFilter: (filter: Partial<OrderFilter>) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  shipOrders: (ids: string[]) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  total: 0,
  loading: false,
  pendingCount: 0,
  filter: { page: 1, pageSize: 50 },
  selectedRowKeys: [],

  loadOrders: async () => {
    set({ loading: true });
    const api = (window as any).electronAPI;
    const { filter } = get();
    const result = await api.invoke(IPC.ORDERS_LIST, {
      status: filter.status,
      platformId: filter.platformId,
      sku: filter.sku,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      limit: filter.pageSize,
      offset: ((filter.page || 1) - 1) * (filter.pageSize || 50),
    });
    set({ orders: result.rows, total: result.total, loading: false });
  },

  setFilter: (partial) => {
    set((s) => ({ filter: { ...s.filter, ...partial } }));
    get().loadOrders();
  },

  setSelectedRowKeys: (keys) => set({ selectedRowKeys: keys }),

  shipOrders: async (ids) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.ORDERS_BATCH_SHIP, ids);
    get().loadOrders();
    get().refreshPendingCount();
  },

  refreshPendingCount: async () => {
    const api = (window as any).electronAPI;
    const count = await api.invoke(IPC.ORDERS_PENDING_COUNT);
    set({ pendingCount: count });
  },
}));
