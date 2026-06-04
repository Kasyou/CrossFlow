import React, { useState } from 'react';
import { Table, Button, InputNumber, Modal, Space, Drawer, Timeline, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useInventoryStore } from '../../stores/inventory-store';
import type { InventoryItem } from '../../types/inventory';

const { Text } = Typography;

const InventoryTable: React.FC = () => {
  const { items, loading, restock, receiveRestock } = useInventoryStore();
  const [restockModal, setRestockModal] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [restockQty, setRestockQty] = useState(0);
  const [logDrawer, setLogDrawer] = useState<{ open: boolean; productId: string; sku: string }>({ open: false, productId: '', sku: '' });
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = async (productId: string) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.invoke('inventory:logs', productId, 50);
    setLogs(result || []);
  };

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
          <Button
            size="small"
            danger
            disabled={record.available > record.safety_stock}
            onClick={async () => {
              const api = (window as any).electronAPI;
              if (!api) return;
              Modal.confirm({
                title: '确认暂停销售',
                content: `将在所有平台上暂停 ${record.sku} 的销售，当前可售库存：${record.available}`,
                okText: '确认暂停',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: async () => {
                  const result = await api.invoke('inventory:pauseSku', record.sku);
                  if (result.success) {
                    message.success(result.message);
                  } else {
                    message.error(result.message);
                  }
                },
              });
            }}
          >
            暂停
          </Button>
          <Button size="small" onClick={() => { fetchLogs(record.product_id); setLogDrawer({ open: true, productId: record.product_id, sku: record.sku }); }}>日志</Button>
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
      <Drawer
        title={`库存变动日志 — ${logDrawer.sku}`}
        open={logDrawer.open}
        onClose={() => setLogDrawer({ open: false, productId: '', sku: '' })}
        width={480}
      >
        {logs.length === 0 ? (
          <Text type="secondary">暂无变动记录</Text>
        ) : (
          <Timeline
            items={logs.map((l: any) => {
              const typeLabels: Record<string, string> = {
                order_reserve: '订单预留', order_release: '订单释放', restock: '补货', adjust: '手动调整', return: '退货入库'
              };
              const colorMap: Record<string, string> = {
                order_reserve: 'blue', order_release: 'green', restock: 'orange', adjust: 'purple', return: 'cyan'
              };
              return {
                color: colorMap[l.change_type] || 'gray',
                children: (
                  <div>
                    <Text strong>{typeLabels[l.change_type] || l.change_type}</Text>
                    <br />
                    <Text>{l.quantity > 0 ? '+' : ''}{l.quantity} 件</Text>
                    {l.available_after !== null && <Text type="secondary"> → 可售 {l.available_after} / 占用 {l.reserved_after}</Text>}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{l.created_at}</Text>
                    {l.note && <><br /><Text type="secondary">{l.note}</Text></>}
                  </div>
                ),
              };
            })}
          />
        )}
      </Drawer>
    </>
  );
};

export default InventoryTable;
