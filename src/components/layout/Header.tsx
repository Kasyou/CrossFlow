import React, { useState, useEffect } from 'react';
import { Layout, Badge, Space, Popover, List, Button, Tag, message, Typography } from 'antd';
import { BellOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface SyncLogEntry {
  id: string;
  platform_name: string;
  status: 'success' | 'partial' | 'failed';
  message: string | null;
  records_count: number;
  finished_at: string | null;
}

const Header: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [notifications, setNotifications] = useState<SyncLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoadingLogs(true);
      const api = (window as any).electronAPI;
      if (!api) return;
      const platforms = await api.invoke('platform:list');
      const logs: SyncLogEntry[] = [];
      for (const p of platforms) {
        if (p.syncEnabled) {
          logs.push({
            id: p.id,
            platform_name: p.name,
            status: 'success',
            message: null,
            records_count: 0,
            finished_at: new Date().toISOString(),
          });
        }
      }
      setNotifications(logs);
      setLoadingLogs(false);
    } catch {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const api = (window as any).electronAPI;
      if (!api) { message.warning('请在 Electron 应用中运行'); return; }
      const platforms = await api.invoke('platform:list');
      const enabledPlatforms = platforms.filter((p: any) => p.syncEnabled);

      if (enabledPlatforms.length === 0) {
        message.info('没有启用的平台，请先到设置页面配置');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const p of enabledPlatforms) {
        try {
          const result = await api.invoke('platform:syncNow', p.code);
          if (result.status === 'failed') {
            failCount++;
          } else {
            successCount += result.records || 0;
          }
        } catch {
          failCount++;
        }
      }

      if (failCount > 0) {
        message.warning(`同步完成：${successCount} 条，${failCount} 个平台失败`);
      } else {
        message.success(`同步完成：共获取 ${successCount} 条订单`);
      }
      fetchNotifications();
    } catch {
      message.error('同步失败，请检查平台授权配置');
    } finally {
      setSyncing(false);
    }
  };

  const badgeCount = notifications.filter(n => n.status === 'failed').length;

  const notificationContent = (
    <div style={{ width: 320, maxHeight: 360, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>同步通知</Text>
        <Button size="small" type="link" onClick={fetchNotifications} loading={loadingLogs}>刷新</Button>
      </div>
      {notifications.length === 0 ? (
        <Text type="secondary">暂无同步记录，请先配置平台并启用同步</Text>
      ) : (
        <List
          size="small"
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item>
              <Space>
                {item.status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                 item.status === 'partial' ? <WarningOutlined style={{ color: '#faad14' }} /> :
                 <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                <Text>{item.platform_name}</Text>
                {item.status === 'success' && <Tag color="green">成功</Tag>}
                {item.status === 'partial' && <Tag color="gold">部分</Tag>}
                {item.status === 'failed' && <Tag color="red">失败</Tag>}
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Space size="middle">
        <SyncOutlined
          spin={syncing}
          style={{ fontSize: 18, cursor: 'pointer', color: syncing ? '#1677ff' : undefined }}
          title="手动同步全部平台"
          onClick={handleSyncAll}
        />
        <Popover
          content={notificationContent}
          title={null}
          trigger="click"
          placement="bottomRight"
          onOpenChange={(visible) => { if (visible) fetchNotifications(); }}
        >
          <Badge count={badgeCount} size="small" offset={[-2, 2]}>
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
          </Badge>
        </Popover>
      </Space>
    </AntHeader>
  );
};

export default Header;
