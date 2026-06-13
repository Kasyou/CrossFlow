import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';

interface SettingsState {
  settings: Record<string, unknown>; loading: boolean; error: string | null;
  loadSettings: () => Promise<void>;
  setSetting: (key: string, value: unknown) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {}, loading: false, error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron' }); return; }
    try { set({ settings: await api.invoke(IPC.SETTINGS_GET) || {}, loading: false }); }
    catch (err: any) { set({ loading: false, error: err.message || 'Failed to load settings' }); }
  },

  setSetting: async (key, value) => { const api = getApi(); if (!api) return; await api.invoke(IPC.SETTINGS_SET, key, value); get().loadSettings(); },
}));
