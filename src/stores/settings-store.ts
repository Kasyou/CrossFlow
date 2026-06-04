import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { PlatformConfig } from '../types/platform';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api;
}

interface SettingsState {
  platforms: PlatformConfig[];
  loading: boolean;
  loadPlatforms: () => Promise<void>;
  saveAuth: (code: string, authData: Record<string, string>) => Promise<void>;
  toggleSync: (code: string, enabled: boolean) => Promise<void>;
  syncNow: (code: string) => Promise<{ status: string; records: number; message: string }>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  platforms: [],
  loading: false,

  loadPlatforms: async () => {
    set({ loading: true });
    const api = getApi();
    if (!api) { set({ loading: false }); return; }
    const platforms = await api.invoke(IPC.PLATFORM_LIST);
    set({ platforms, loading: false });
  },

  saveAuth: async (code, authData) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.PLATFORM_SAVE_AUTH, code, authData);
    get().loadPlatforms();
  },

  toggleSync: async (code, enabled) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.PLATFORM_TOGGLE_SYNC, code, enabled);
    get().loadPlatforms();
  },

  syncNow: async (code) => {
    const api = getApi();
    if (!api) return;
    return api.invoke(IPC.PLATFORM_SYNC_NOW, code);
  },
}));
