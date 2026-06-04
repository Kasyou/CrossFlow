import React from 'react';
import { Table, Button, Space, Select, Typography, Tag, message } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useOrderStore } from '../../stores/order-store';
import OrderStatusTag from './OrderStatusTag';
import type { Order } from '../../types/order';

const { Text } = Typography;

const columns: ColumnsType<Order> = [
  { title: '平台', dataIndex: 'platform_name', width: 80 },
  { title: '订单号', dataIndex: 'platform_order_id', width: 180, ellipsis: true },
  { title: 'SKU', dataIndex: 'sku', width: 120 },
  { title: '数量', dataIndex: 'quantity', width: 60 },
  { title: '金额', dataIndex: 'total_amount', width: 100, render: (v, r) => `${r.currency} ${v}` },
  {
    title: '物流', dataIndex: 'tracking_number', width: 100,
    render: (v: string | null, record: any) => {
      if (!v) return <Text type="secondary">-</Text>;
      if (record.status === 'delivered') return <Tag color="green">已签收</Tag>;
      if (record.status === 'shipped') return <Tag color="blue">运输中</Tag>;
      return <Text type="secondary">-</Text>;
    },
  },
  { title: '状态', dataIndex: 'status', width: 100, render: (s) => <OrderStatusTag status={s} /> },
  { title: '下单时间', dataIndex: 'order_time', width: 160, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
];

const OrderTable: React.FC = () => {
  const { orders, total, loading, filter, selectedRowKeys, setFilter, setSelectedRowKeys, shipOrders } = useOrderStore();

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<SyncOutlined />}
          onClick={async () => {
            const api = (window as any).electronAPI;
            if (!api) return;
            const results = await api.invoke('tracking:check');
            const delayed = results.filter((r: any) => r.status === 'delayed');
            if (delayed.length > 0) {
              message.warning(`${delayed.length} 个包裹可能延迟`);
            } else {
              message.success('所有包裹运输正常');
            }
          }}
        >
          检查物流
        </Button>
        <Select
          style={{ width: 120 }}
          placeholder="状态筛选"
          allowClear
          onChange={(v) => setFilter({ status: v })}
          options={[
            { label: '待处理', value: 'pending' },
            { label: '已发货', value: 'shipped' },
            { label: '退货', value: 'refunding' },
          ]}
        />
        <Button
          type="primary"
          disabled={selectedRowKeys.length === 0}
          onClick={() => shipOrders(selectedRowKeys)}
        >
          批量发货 ({selectedRowKeys.length})
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
        pagination={{
          current: filter.page,
          pageSize: filter.pageSize || 50,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setFilter({ page, pageSize }),
        }}
      />
    </div>
  );
};

export default OrderTable;
