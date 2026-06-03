import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { PlatformConfig } from '../types/platform';

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
    const api = (window as any).electronAPI;
    const platforms = await api.invoke(IPC.PLATFORM_LIST);
    set({ platforms, loading: false });
  },

  saveAuth: async (code, authData) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.PLATFORM_SAVE_AUTH, code, authData);
    get().loadPlatforms();
  },

  toggleSync: async (code, enabled) => {
    const api = (window as any).electronAPI;
    await api.invoke(IPC.PLATFORM_TOGGLE_SYNC, code, enabled);
    get().loadPlatforms();
  },

  syncNow: async (code) => {
    const api = (window as any).electronAPI;
    return api.invoke(IPC.PLATFORM_SYNC_NOW, code);
  },
}));
