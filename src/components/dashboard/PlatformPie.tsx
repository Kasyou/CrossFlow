import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboardStore } from '../../stores/dashboard-store';

const PlatformPie: React.FC = () => {
  const { platformShare } = useDashboardStore();

  const option = {
    tooltip: { trigger: 'item' as const },
    series: [{
      type: 'pie' as const,
      radius: ['40%', '70%'],
      data: platformShare.map((p) => ({ name: p.platformName, value: p.revenue })),
      label: { formatter: '{b}\n{d}%' },
    }],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
};

export default PlatformPie;
