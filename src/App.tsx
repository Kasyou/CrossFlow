import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp, Alert } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import ErrorBoundary from './components/shared/ErrorBoundary';

const App: React.FC = () => {
  const [apiReady, setApiReady] = React.useState(true);

  React.useEffect(() => {
    const hasApi = !!(window as any).electronAPI;
    setApiReady(hasApi);
    if (!hasApi) console.warn('Running outside Electron — some features unavailable');
  }, []);

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1677ff' } }}>
      <AntApp>
        <HashRouter>
          <div style={{ display: 'flex', height: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Header />
              <main style={{ flex: 1, padding: 24, overflow: 'auto', background: '#f5f5f5' }}>
                {!apiReady && (
                  <Alert
                    message="未检测到 Electron 环境，数据同步功能不可用。请在 CrossFlow 桌面应用中打开。"
                    type="warning"
                    showIcon
                    closable
                    style={{ margin: '0 0 16px 0' }}
                  />
                )}
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Navigate to="/onboarding" replace />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
