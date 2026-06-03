import React from 'react';
import { Alert, List } from 'antd';
import { useInventoryStore } from '../../stores/inventory-store';

const StockAlert: React.FC = () => {
  const lowStock = useInventoryStore((s) => s.lowStock);
  if (lowStock.length === 0) return null;

  return (
    <Alert
      type="error"
      message={`库存预警：${lowStock.length} 个SKU库存低于安全线`}
      description={
        <List size="small" dataSource={lowStock.slice(0, 5)} renderItem={(item) => (
          <List.Item>
            <strong>{item.sku}</strong> — {item.product_name} | 可售 {item.available} / 安全线 {item.safety_stock} | {item.warehouse_name}
          </List.Item>
        )} />
      }
      style={{ marginBottom: 16 }}
    />
  );
};

export default StockAlert;
