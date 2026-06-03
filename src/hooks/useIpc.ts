export function useIpc() {
  const api = (window as any).electronAPI;
  if (!api) throw new Error('electronAPI not available — running outside Electron?');
  return {
    invoke: api.invoke as (channel: string, ...args: any[]) => Promise<any>,
    on: api.on as (channel: string, callback: (...args: any[]) => void) => () => void,
  };
}
