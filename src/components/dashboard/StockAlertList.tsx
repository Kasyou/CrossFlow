import React from 'react';
import { List, Typography } from 'antd';
import { useInventoryStore } from '../../stores/inventory-store';

const { Text } = Typography;

const StockAlertList: React.FC = () => {
  const { lowStock } = useInventoryStore();

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
