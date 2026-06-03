import React, { useState } from 'react';
import { Table, Button, InputNumber, Modal, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useInventoryStore } from '../../stores/inventory-store';
import type { InventoryItem } from '../../types/inventory';

const InventoryTable: React.FC = () => {
  const { items, loading, restock, receiveRestock } = useInventoryStore();
  const [restockModal, setRestockModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [restockQty, setRestockQty] = useState(0);

  const columns: ColumnsType<InventoryItem> = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'product_name', width: 160 },
    { title: '仓库', dataIndex: 'warehouse_name', width: 100 },
    { title: '可售', dataIndex: 'available', width: 80, render: (v, r) => (
      <span style={{ color: v < r.safety_stock ? 'red' : 'inherit', fontWeight: v < r.safety_stock ? 'bold' : 'normal' }}>{v}</span>
    )},
    { title: '已占用', dataIndex: 'reserved', width: 80 },
    { title: '在途', dataIndex: 'in_transit', width: 80 },
    { title: '安全库存', dataIndex: 'safety_stock', width: 80 },
    {
      title: '操作', width: 200, render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setRestockModal({ open: true, item: record }); setRestockQty(0); }}>补货</Button>
          <Button size="small" onClick={() => receiveRestock(record.product_id, record.warehouse_id, record.in_transit)} disabled={record.in_transit <= 0}>到仓</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 条` }} />
      <Modal
        title="补货下单"
        open={restockModal.open}
        onCancel={() => setRestockModal({ open: false })}
        onOk={() => {
          if (restockModal.item && restockQty > 0) {
            restock(restockModal.item.product_id, restockModal.item.warehouse_id, restockQty);
            setRestockModal({ open: false });
          }
        }}
      >
        <p>SKU: {restockModal.item?.sku} — {restockModal.item?.product_name}</p>
        <p>仓库: {restockModal.item?.warehouse_name}</p>
        <InputNumber min={1} value={restockQty} onChange={(v) => setRestockQty(v || 0)} placeholder="补货数量" style={{ width: '100%' }} />
      </Modal>
    </>
  );
};

export default InventoryTable;
