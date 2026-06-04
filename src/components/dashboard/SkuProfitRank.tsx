import React from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDashboardStore } from '../../stores/dashboard-store';

interface SkuProfitItem {
  sku: string;
  productName: string;
  revenue: number;
  orderCount: number;
  estimatedProfit: number;
}

const columns: ColumnsType<SkuProfitItem> = [
  { title: 'SKU', dataIndex: 'sku', width: 120 },
  { title: '商品名称', dataIndex: 'productName', width: 140, ellipsis: true },
  { title: '销量', dataIndex: 'orderCount', width: 70 },
  { title: '销售额', dataIndex: 'revenue', width: 100, render: (v) => `$${v.toFixed(0)}` },
  { title: '估算利润', dataIndex: 'estimatedProfit', width: 100, render: (v) => (
    <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>${v.toFixed(0)}</span>
  )},
];

const SkuProfitRank: React.FC = () => {
  const { skuProfit } = useDashboardStore();
  return (
    <Table
      rowKey="sku"
      columns={columns}
      dataSource={skuProfit}
      pagination={false}
      size="small"
      locale={{ emptyText: '暂无数据' }}
    />
  );
};

export default SkuProfitRank;
