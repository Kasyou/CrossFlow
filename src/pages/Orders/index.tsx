import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, List, message, Typography } from 'antd';
import OrderTable from '../../components/order/OrderTable';
import { useOrderStore } from '../../stores/order-store';

const { Title, Text } = Typography;

const Orders: React.FC = () => {
  const { loadOrders, refreshPendingCount } = useOrderStore();
  const [mergeGroups, setMergeGroups] = useState<any[]>([]);

  const checkMerges = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const groups = await api.invoke('orders:mergeable');
    setMergeGroups(groups || []);
  };

  useEffect(() => {
    loadOrders();
    refreshPendingCount();
    checkMerges();
  }, []);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>订单管理</Title>
      {mergeGroups.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`发现 ${mergeGroups.length} 组可合并订单`}
          description={
            <List size="small" dataSource={mergeGroups.slice(0, 3)} renderItem={(g: any) => (
              <List.Item actions={[
                <Button size="small" type="primary" onClick={async () => {
                  const api = (window as any).electronAPI;
                  if (!api) return;
                  const result = await api.invoke('orders:merge', g.order_ids);
                  message.success(result.message);
                  loadOrders();
                  checkMerges();
                }}>合并 ({g.cnt}单)</Button>
              ]}>
                <Text>{g.sku} x {g.cnt}单 -- 同地址</Text>
              </List.Item>
            )} />
          }
          style={{ marginBottom: 16 }}
          closable
        />
      )}
      <Card>
        <OrderTable />
      </Card>
    </div>
  );
};

export default Orders;
