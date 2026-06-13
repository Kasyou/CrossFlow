export function getApi() {
  const api = window.electronAPI; // typed global from electron.d.ts
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api as { invoke: (ch: string, ...args: unknown[]) => Promise<any>; on: (ch: string, cb: (...args: unknown[]) => void) => () => void };
}
