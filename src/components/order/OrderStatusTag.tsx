import React from 'react';
import { Tag } from 'antd';
import type { OrderStatus } from '../../types/order';

const statusConfig: Record<OrderStatus, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待处理' },
  matched: { color: 'blue', label: '已匹配' },
  shipped: { color: 'cyan', label: '已发货' },
  delivered: { color: 'green', label: '已签收' },
  refunding: { color: 'red', label: '退款中' },
  refunded: { color: 'volcano', label: '已退款' },
  cancelled: { color: 'default', label: '已取消' },
};

const OrderStatusTag: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const config = statusConfig[status] || { color: 'default', label: status };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default OrderStatusTag;
