import React, { useEffect } from 'react';
import { Card, Typography } from 'antd';
import OrderTable from '../../components/order/OrderTable';
import { useOrderStore } from '../../stores/order-store';

const { Title } = Typography;

const Orders: React.FC = () => {
  const { loadOrders, refreshPendingCount } = useOrderStore();

  useEffect(() => {
    loadOrders();
    refreshPendingCount();
  }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>订单管理</Title>
      <Card>
        <OrderTable />
      </Card>
    </div>
  );
};

export default Orders;
