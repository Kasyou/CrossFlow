import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import type { Warehouse } from '../../types/inventory';
import { useInventoryStore } from '../../stores/inventory-store';

const typeLabels: Record<string, string> = { domestic: '国内仓', fba: 'FBA仓', overseas: '海外仓' };

const WarehouseCard: React.FC<{ warehouse: Warehouse }> = ({ warehouse }) => {
  const items = useInventoryStore((s) => s.items.filter((i) => i.warehouse_id === warehouse.id));
  const totalAvailable = items.reduce((sum, i) => sum + i.available, 0);
  const totalReserved = items.reduce((sum, i) => sum + i.reserved, 0);
  const totalInTransit = items.reduce((sum, i) => sum + i.in_transit, 0);

  return (
    <Card title={`${warehouse.name} (${typeLabels[warehouse.type] || warehouse.type})`} size="small">
      <Row gutter={16}>
        <Col span={8}><Statistic title="可售" value={totalAvailable} /></Col>
        <Col span={8}><Statistic title="已占用" value={totalReserved} /></Col>
        <Col span={8}><Statistic title="在途" value={totalInTransit} /></Col>
      </Row>
    </Card>
  );
};

export default WarehouseCard;
