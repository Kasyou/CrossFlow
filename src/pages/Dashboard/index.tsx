import React, { useEffect } from 'react';
import { Row, Col, Card, Typography } from 'antd';
import { useDashboardStore } from '../../stores/dashboard-store';
import { useInventoryStore } from '../../stores/inventory-store';
import MetricCard from '../../components/dashboard/MetricCard';
import SalesChart from '../../components/dashboard/SalesChart';
import PlatformPie from '../../components/dashboard/PlatformPie';
import StockAlertList from '../../components/dashboard/StockAlertList';
import SkuProfitRank from '../../components/dashboard/SkuProfitRank';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const { metrics, loadAll } = useDashboardStore();
  const { loadLowStock } = useInventoryStore();

  useEffect(() => { loadAll(); loadLowStock(); }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>经营仪表盘</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <MetricCard title="今日销售额" value={metrics?.todayRevenue || 0} prefix="$" yesterdayValue={metrics?.yesterdayRevenue} format={(v) => v.toFixed(2)} />
        </Col>
        <Col span={6}>
          <MetricCard title="今日订单" value={metrics?.todayOrderCount || 0} suffix="单" yesterdayValue={metrics?.yesterdayOrderCount} />
        </Col>
        <Col span={6}>
          <MetricCard title="SKU总数" value={metrics?.totalSkuCount || 0} suffix="个" />
        </Col>
        <Col span={6}>
          <MetricCard title="库存周转" value={metrics?.avgInventoryTurnoverDays || 0} suffix="天" />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="近30天销售趋势"><SalesChart /></Card>
        </Col>
        <Col span={8}>
          <Card title="平台销售占比"><PlatformPie /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="库存预警 TOP10"><StockAlertList /></Card>
        </Col>
        <Col span={12}>
          <Card title="SKU利润排行 TOP20"><SkuProfitRank /></Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
