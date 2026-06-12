import { create } from 'zustand';

function api() { return (window as any).electronAPI; }

interface ReviewStore {
  reviews: any[];
  alerts: any[];
  loading: boolean;
  loadAll: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [], alerts: [], loading: false,
  loadAll: async () => { const a = api(); if (!a) return; set({ loading: true }); set({ reviews: await a.invoke('review:list') || [], loading: false }); },
  loadAlerts: async () => { const a = api(); if (!a) return; set({ alerts: await a.invoke('review:alerts') || [] }); },
  acknowledgeAlert: async (id) => { const a = api(); if (!a) return; await a.invoke('review:acknowledge', id); get().loadAlerts(); },
}));
