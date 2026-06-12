import React, { useEffect } from 'react';
import { Card, Typography, Table, Tag, Button, Space, Alert, message } from 'antd';
import { useReviewStore } from '../../stores/review-store';

const { Title, Text } = Typography;

const Reviews: React.FC = () => {
  const { reviews, alerts, loading, loadAll, loadAlerts, acknowledgeAlert } = useReviewStore();
  useEffect(() => { loadAll(); loadAlerts(); }, []);

  return (
    <div>
      <Title level={3} style={{ margin: 0, marginBottom: 16 }}>评价管理</Title>
      {alerts.length > 0 && (
        <Alert type="error" showIcon message={`${alerts.length} 条未处理差评预警`}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => { alerts.forEach((a: any) => acknowledgeAlert(a.id)); message.success('全部已标记'); }}>全部标记已读</Button>}
        />
      )}
      <Card>
        <Table rowKey="id" size="small" loading={loading} dataSource={reviews}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 120 }, { title: '商品', dataIndex: 'product_name', width: 140, ellipsis: true },
            { title: '平台', dataIndex: 'platform_name', width: 80 },
            { title: '评分', dataIndex: 'rating', width: 70, render: (v: number) => <Tag color={v <= 2 ? 'red' : v === 3 ? 'orange' : 'green'}>{v}★</Tag> },
            { title: '内容', dataIndex: 'content', ellipsis: true }, { title: '买家', dataIndex: 'reviewer_name', width: 100 },
            { title: '日期', dataIndex: 'review_date', width: 120, render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
            { title: '状态', dataIndex: 'is_negative', width: 80, render: (v: number) => v ? <Tag color="red">差评</Tag> : <Tag>正常</Tag> },
          ]}
        />
      </Card>
    </div>
  );
};

export default Reviews;
