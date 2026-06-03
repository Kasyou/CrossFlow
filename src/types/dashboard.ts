export interface DashboardMetrics {
  todayRevenue: number;
  todayOrderCount: number;
  yesterdayRevenue: number;
  yesterdayOrderCount: number;
  avgInventoryTurnoverDays: number;
  totalSkuCount: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
  platformId: string;
  platformName: string;
}

export interface PlatformSalesShare {
  platformId: string;
  platformName: string;
  revenue: number;
  percentage: number;
}

export interface SkuProfitRank {
  sku: string;
  productName: string;
  revenue: number;
  orderCount: number;
  estimatedProfit: number;
}
