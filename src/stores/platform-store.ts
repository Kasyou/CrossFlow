import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';
import type { PlatformConfig } from '../types/platform';

interface PlatformState {
  platforms: PlatformConfig[]; loading: boolean; error: string | null;
  loadPlatforms: () => Promise<void>;
  saveAuth: (code: string, authData: Record<string, string>) => Promise<void>;
  toggleSync: (code: string, enabled: boolean) => Promise<void>;
  syncNow: (code: string) => Promise<{ status: string; records: number; message: string }>;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  platforms: [], loading: false, error: null,

  loadPlatforms: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ platforms: await api.invoke(IPC.PLATFORM_LIST) || [], loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load platforms' }); }
  },

  saveAuth: async (code, authData) => { const api = getApi(); if (!api) return; await api.invoke(IPC.PLATFORM_SAVE_AUTH, code, authData); get().loadPlatforms(); },
  toggleSync: async (code, enabled) => { const api = getApi(); if (!api) return; await api.invoke(IPC.PLATFORM_TOGGLE_SYNC, code, enabled); get().loadPlatforms(); },
  syncNow: async (code) => { const api = getApi(); if (!api) return { status: 'failed', records: 0, message: 'Not in Electron' }; return api.invoke(IPC.PLATFORM_SYNC_NOW, code); },
}));
