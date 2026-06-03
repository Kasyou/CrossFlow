import React from 'react';
import { Table, Button, Space, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useOrderStore } from '../../stores/order-store';
import OrderStatusTag from './OrderStatusTag';
import type { Order } from '../../types/order';

const columns: ColumnsType<Order> = [
  { title: '平台', dataIndex: 'platform_name', width: 80 },
  { title: '订单号', dataIndex: 'platform_order_id', width: 180, ellipsis: true },
  { title: 'SKU', dataIndex: 'sku', width: 120 },
  { title: '数量', dataIndex: 'quantity', width: 60 },
  { title: '金额', dataIndex: 'total_amount', width: 100, render: (v, r) => `${r.currency} ${v}` },
  { title: '状态', dataIndex: 'status', width: 100, render: (s) => <OrderStatusTag status={s} /> },
  { title: '下单时间', dataIndex: 'order_time', width: 160, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
];

const OrderTable: React.FC = () => {
  const { orders, total, loading, filter, selectedRowKeys, setFilter, setSelectedRowKeys, shipOrders } = useOrderStore();

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
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
