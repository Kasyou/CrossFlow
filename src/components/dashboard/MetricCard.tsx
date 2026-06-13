import React from 'react';
import { Card, Statistic, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface MetricCardProps {
  title: string; value: number;
  prefix?: string; suffix?: string; yesterdayValue?: number;
  format?: (v: number) => string; loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, prefix, suffix, yesterdayValue, format, loading }) => {
  if (loading) return <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>;
  const diff = yesterdayValue !== undefined ? value - yesterdayValue : 0;
  const pct = yesterdayValue && yesterdayValue !== 0 ? Math.round((diff / yesterdayValue) * 100) : 0;

  const displayValue = format ? format(value) : String(value);

  return (
    <Card>
      <Statistic
        title={title}
        value={displayValue}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ fontSize: 28 }}
      />
      {yesterdayValue !== undefined && (
        <div style={{ marginTop: 8, fontSize: 13, color: diff >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {diff >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {' '}{diff >= 0 ? '+' : ''}{pct}% vs 昨日
        </div>
      )}
    </Card>
  );
};

export default MetricCard;
