import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, ShoppingCartOutlined, InboxOutlined, SettingOutlined, CompassOutlined, TagOutlined, ShopOutlined, StarOutlined, GlobalOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/onboarding', icon: <CompassOutlined />, label: '快速入门' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '经营仪表盘' },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
  { key: '/inventory', icon: <InboxOutlined />, label: '库存管理' },
  { key: '/products', icon: <TagOutlined />, label: '商品管理' },
  { key: '/procurement', icon: <ShopOutlined />, label: '采购管理' },
  { key: '/freight', icon: <GlobalOutlined />, label: '货运管理' },
  { key: '/reviews', icon: <StarOutlined />, label: '评价管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1677ff' }}>CrossFlow</h1>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0 }}
      />
    </Sider>
  );
};

export default Sidebar;
