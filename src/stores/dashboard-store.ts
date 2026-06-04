import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import type { DashboardMetrics, SalesTrendPoint, PlatformSalesShare, SkuProfitRank } from '../types/dashboard';

function getApi() {
  const api = (window as any).electronAPI;
  if (!api) {
    console.warn('electronAPI not available — running outside Electron');
    return null;
  }
  return api;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  salesTrend: SalesTrendPoint[];
  platformShare: PlatformSalesShare[];
  skuProfit: SkuProfitRank[];
  lowStock: any[];
  loading: boolean;
  loadAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null,
  salesTrend: [],
  platformShare: [],
  skuProfit: [],
  lowStock: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const api = getApi();
    if (!api) { set({ loading: false }); return; }
    const [metrics, salesTrend, platformShare, skuProfit, lowStock] = await Promise.all([
      api.invoke(IPC.DASHBOARD_METRICS),
      api.invoke(IPC.DASHBOARD_SALES_TREND, 30),
      api.invoke(IPC.DASHBOARD_PLATFORM_SHARE),
      api.invoke(IPC.DASHBOARD_SKU_PROFIT),
      api.invoke(IPC.INVENTORY_LOW_STOCK),
    ]);
    set({ metrics, salesTrend, platformShare, skuProfit, lowStock, loading: false });
  },
}));
