import { contextBridge, ipcRenderer, webUtils } from 'electron';

const electronAPI = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
