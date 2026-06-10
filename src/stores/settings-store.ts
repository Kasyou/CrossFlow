import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api;
}

interface SettingsState {
  settings: Record<string, unknown>;
  loading: boolean;
  loadSettings: () => Promise<void>;
  setSetting: (key: string, value: unknown) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loading: false,

  loadSettings: async () => {
    set({ loading: true });
    const api = getApi();
    if (!api) { set({ loading: false }); return; }
    const settings = await api.invoke(IPC.SETTINGS_GET);
    set({ settings, loading: false });
  },

  setSetting: async (key, value) => {
    const api = getApi();
    if (!api) return;
    await api.invoke(IPC.SETTINGS_SET, key, value);
    get().loadSettings();
  },
}));
