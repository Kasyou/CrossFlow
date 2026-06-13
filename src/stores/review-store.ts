import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';

interface ReviewStore {
  reviews: any[]; alerts: any[]; loading: boolean; error: string | null;
  loadAll: () => Promise<void>; loadAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [], alerts: [], loading: false, error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    const a = getApi(); if (!a) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ reviews: await a.invoke(IPC.REVIEW_LIST) || [], loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load reviews' }); }
  },

  loadAlerts: async () => { const a = getApi(); if (!a) return; set({ alerts: await a.invoke(IPC.REVIEW_ALERTS) || [] }); },
  acknowledgeAlert: async (id) => { const a = getApi(); if (!a) return; await a.invoke(IPC.REVIEW_ACKNOWLEDGE, id); get().loadAlerts(); },
}));
