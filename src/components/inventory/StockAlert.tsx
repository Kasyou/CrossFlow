import React from 'react';
import { Alert, Button, List, message } from 'antd';
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
            <span><strong>{item.sku}</strong> — {item.product_name} | 可售 {item.available} / 安全线 {item.safety_stock} | {item.warehouse_name}</span>
            <Button
              type="link"
              danger
              size="small"
              onClick={async (e) => {
                e.stopPropagation();
                const api = (window as any).electronAPI;
                if (!api) return;
                await api.invoke('inventory:pauseSku', item.sku);
                message.success(`已暂停 ${item.sku}`);
              }}
            >
              暂停销售
            </Button>
          </List.Item>
        )} />
      }
      style={{ marginBottom: 16 }}
    />
  );
};

export default StockAlert;
