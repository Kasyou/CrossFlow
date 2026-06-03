import React from 'react';
import { Layout, Badge, Space } from 'antd';
import { BellOutlined, SyncOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Space size="middle">
        <SyncOutlined style={{ fontSize: 18, cursor: 'pointer' }} title="手动同步" />
        <Badge count={3} size="small">
          <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        </Badge>
      </Space>
    </AntHeader>
  );
};

export default Header;
