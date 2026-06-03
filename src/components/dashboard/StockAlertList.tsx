import React from 'react';
import { List, Typography } from 'antd';
import { useDashboardStore } from '../../stores/dashboard-store';

const { Text } = Typography;

const StockAlertList: React.FC = () => {
  const { lowStock } = useDashboardStore();

  return (
    <List
      size="small"
      dataSource={lowStock}
      renderItem={(item: any) => (
        <List.Item>
          <Text strong>{item.sku}</Text>
          <Text type="secondary"> — {item.product_name} | {item.warehouse_name}</Text>
          <Text type="danger"> 可售{item.available}/安全线{item.safety_stock}</Text>
        </List.Item>
      )}
    />
  );
};

export default StockAlertList;
