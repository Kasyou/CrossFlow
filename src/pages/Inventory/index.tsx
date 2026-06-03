import React, { useEffect } from 'react';
import { Card, Typography, Row, Col } from 'antd';
import { useInventoryStore } from '../../stores/inventory-store';
import StockAlert from '../../components/inventory/StockAlert';
import WarehouseCard from '../../components/inventory/WarehouseCard';
import InventoryTable from '../../components/inventory/InventoryTable';

const { Title } = Typography;

const Inventory: React.FC = () => {
  const { loadAll, loadLowStock, loadWarehouses, warehouses } = useInventoryStore();

  useEffect(() => {
    loadAll();
    loadLowStock();
    loadWarehouses();
  }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>库存管理</Title>
      <StockAlert />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {warehouses.map((w) => (
          <Col span={8} key={w.id}><WarehouseCard warehouse={w} /></Col>
        ))}
      </Row>
      <Card title="库存明细">
        <InventoryTable />
      </Card>
    </div>
  );
};

export default Inventory;
