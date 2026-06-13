import React, { useEffect } from 'react';
import { Row, Col, Card, Typography, Skeleton, Alert, Empty } from 'antd';
import { useDashboardStore } from '../../stores/dashboard-store';
import { useInventoryStore } from '../../stores/inventory-store';
import MetricCard from '../../components/dashboard/MetricCard';
import SalesChart from '../../components/dashboard/SalesChart';
import PlatformPie from '../../components/dashboard/PlatformPie';
import StockAlertList from '../../components/dashboard/StockAlertList';
import SkuProfitRank from '../../components/dashboard/SkuProfitRank';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const { metrics, loading, error, loadAll } = useDashboardStore();
  const { loadLowStock } = useInventoryStore();

  useEffect(() => { loadAll(); loadLowStock(); }, []);

  if (error) {
    return (
      <div>
        <Title level={3} style={{ marginTop: 0 }}>经营仪表盘</Title>
        <Alert type="error" message="加载失败" description={error} showIcon style={{ marginBottom: 16 }} />
      </div>
    );
  }

  const hasData = metrics && (metrics.todayRevenue > 0 || metrics.todayOrderCount > 0 || metrics.totalSkuCount > 0);
  if (!loading && !hasData) {
    return (
      <div>
        <Title level={3} style={{ marginTop: 0 }}>经营仪表盘</Title>
        <Card><Empty description="暂无数据，请先配置平台并开始同步订单" /></Card>
      </div>
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>经营仪表盘</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <MetricCard title="今日销售额" value={metrics?.todayRevenue || 0} prefix="$" yesterdayValue={metrics?.yesterdayRevenue} format={(v) => v.toFixed(2)} loading={loading} />
        </Col>
        <Col span={6}>
          <MetricCard title="今日订单" value={metrics?.todayOrderCount || 0} suffix="单" loading={loading} yesterdayValue={metrics?.yesterdayOrderCount} />
        </Col>
        <Col span={6}>
          <MetricCard title="SKU总数" value={metrics?.totalSkuCount || 0} suffix="个" loading={loading} />
        </Col>
        <Col span={6}>
          <MetricCard title="库存周转" value={metrics?.avgInventoryTurnoverDays || 0} suffix="天" loading={loading} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="近30天销售趋势">{loading ? <Skeleton active paragraph={{ rows: 8 }} /> : <SalesChart />}</Card>
        </Col>
        <Col span={8}>
          <Card title="平台销售占比">{loading ? <Skeleton active paragraph={{ rows: 4 }} /> : <PlatformPie />}</Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="库存预警 TOP10">{loading ? <Skeleton active paragraph={{ rows: 5 }} /> : <StockAlertList />}</Card>
        </Col>
        <Col span={12}>
          <Card title="SKU利润排行 TOP20">{loading ? <Skeleton active paragraph={{ rows: 10 }} /> : <SkuProfitRank />}</Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
