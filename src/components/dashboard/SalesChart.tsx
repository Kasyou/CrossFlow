import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboardStore } from '../../stores/dashboard-store';

const SalesChart: React.FC = () => {
  const { salesTrend } = useDashboardStore();
  const platforms = [...new Set(salesTrend.map((p) => p.platformName))];

  const option = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: platforms },
    xAxis: { type: 'category' as const, data: [...new Set(salesTrend.map((p) => p.date))] },
    yAxis: { type: 'value' as const },
    series: platforms.map((name) => ({
      name,
      type: 'line' as const,
      data: salesTrend.filter((p) => p.platformName === name).map((p) => p.revenue),
      smooth: true,
    })),
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
};

export default SalesChart;
