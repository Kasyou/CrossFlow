import { create } from 'zustand';
import { IPC } from '../shared/ipc-channels';
import { getApi } from '../shared/getApi';
import type { DashboardMetrics, SalesTrendPoint, PlatformSalesShare, SkuProfitRank } from '../types/dashboard';

interface DashboardState {
  metrics: DashboardMetrics | null;
  salesTrend: SalesTrendPoint[];
  platformShare: PlatformSalesShare[];
  skuProfit: SkuProfitRank[];
  loading: boolean;
  error: string | null;
  loadAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null, salesTrend: [], platformShare: [], skuProfit: [],
  loading: false, error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    const api = getApi();
    if (!api) { set({ loading: false, error: 'Not in Electron environment' }); return; }
    try {
      const [metrics, salesTrend, platformShare, skuProfit] = await Promise.all([
        api.invoke(IPC.DASHBOARD_METRICS),
        api.invoke(IPC.DASHBOARD_SALES_TREND, 30),
        api.invoke(IPC.DASHBOARD_PLATFORM_SHARE),
        api.invoke(IPC.DASHBOARD_SKU_PROFIT),
      ]);
      set({ metrics, salesTrend, platformShare, skuProfit, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to load dashboard' });
    }
  },
}));
