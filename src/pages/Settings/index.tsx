import React, { useEffect, useState } from 'react';
import { Card, Typography, List, Switch, Button, Tag, Modal, Form, Input, message, Space } from 'antd';
import { useSettingsStore } from '../../stores/settings-store';
import ImportExcel from '../../components/shared/ImportExcel';

const { Title, Text } = Typography;

const platformDefaults = [
  { code: 'amazon', name: 'Amazon', fields: ['clientId', 'clientSecret', 'refreshToken', 'region'] },
  { code: 'shopee', name: 'Shopee', fields: ['partnerId', 'partnerKey', 'shopId'] },
  { code: 'tiktok', name: 'TikTok Shop', fields: [] },
  { code: 'temu', name: 'Temu', fields: [] },
  { code: 'lazada', name: 'Lazada', fields: ['appKey', 'appSecret', 'accessToken'] },
];

const Settings: React.FC = () => {
  const { platforms, loadPlatforms, saveAuth, toggleSync, syncNow } = useSettingsStore();
  const [authModal, setAuthModal] = useState<{ open: boolean; code: string; name: string; fields: string[] }>({ open: false, code: '', name: '', fields: [] });
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => { loadPlatforms(); }, []);

  const handleSyncNow = async (code: string) => {
    setSyncing(code);
    try {
      const result = await syncNow(code);
      if (result.status === 'failed') message.error(`同步失败：${result.message}`);
      else message.success(`同步完成：${result.records} 条`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>设置</Title>

      <Card title="平台管理" style={{ marginBottom: 16 }}>
        <List
          dataSource={platformDefaults}
          renderItem={(pd) => {
            const config = platforms.find((p) => p.code === pd.code);
            return (
              <List.Item
                actions={[
                  <Switch
                    key="sync"
                    checked={config?.syncEnabled ?? false}
                    onChange={(v) => toggleSync(pd.code, v)}
                  />,
                  <Button key="auth" size="small" onClick={() => {
                    setAuthModal({ open: true, code: pd.code, name: pd.name, fields: pd.fields });
                    form.resetFields();
                  }}>
                    {config?.authConfigured ? '更新授权' : '配置授权'}
                  </Button>,
                  <Button key="syncnow" size="small" loading={syncing === pd.code} onClick={() => handleSyncNow(pd.code)}>立即同步</Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Space>{pd.name} {config?.authConfigured && <Tag color="green">已授权</Tag>}</Space>}
                  description={`自动同步：${config?.syncEnabled ? '开启' : '关闭'} | 间隔：${(config?.syncInterval || 900) / 60}分钟`}
                />
                {(pd.code === 'temu' || pd.code === 'tiktok') && (
                  <ImportExcel platformCode={pd.code} platformName={pd.name} onImported={() => loadPlatforms()} />
                )}
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title="数据备份" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Text>备份目录：</Text>
          <Button onClick={async () => {
            const api = (window as any).electronAPI;
            if (!api) return;
            const path = prompt('请输入备份目录路径（例如：D:\\Backup）');
            if (path) {
              await api.invoke('settings:set', 'backupPath', path);
              message.success('备份目录已设置');
            }
          }}>
            设置备份目录
          </Button>
          <Text type="secondary">设置后每日自动备份数据库</Text>
        </div>
      </Card>

      <Modal
        title={`配置 ${authModal.name} 授权`}
        open={authModal.open}
        onCancel={() => setAuthModal({ ...authModal, open: false })}
        onOk={async () => {
          const values = await form.validateFields();
          await saveAuth(authModal.code, values);
          setAuthModal({ ...authModal, open: false });
          message.success('授权信息已保存');
        }}
      >
        <Form form={form} layout="vertical">
          {authModal.fields.map((f) => (
            <Form.Item key={f} name={f} label={f} rules={[{ required: true, message: `请输入${f}` }]}>
              <Input.Password placeholder={f} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
