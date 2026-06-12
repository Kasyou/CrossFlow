import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, InputNumber, Select, Tag, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Freight: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const api = (window as any).electronAPI; if (!api) return;
    setLoading(true); setShipments(await api.invoke('freight:list') || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const statusColor: Record<string, string> = { planned: 'default', in_transit: 'blue', arrived: 'orange', customs: 'gold', delivered: 'green' };

  return (
    <div>
      <Title level={3} style={{ margin: 0, marginBottom: 16 }}>货运管理</Title>
      <Card extra={<Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>新建货运单</Button>}>
        <Table rowKey="id" size="small" loading={loading} dataSource={shipments}
          columns={[
            { title: '批次号', dataIndex: 'shipment_ref', width: 120 }, { title: '运输方式', dataIndex: 'transport_mode', width: 80, render: (v: string) => <Tag>{v}</Tag> },
            { title: '柜号/提单号', dataIndex: 'container_number', width: 130 }, { title: '起运港', dataIndex: 'origin', width: 100 },
            { title: '目的港', dataIndex: 'destination', width: 100 },
            { title: '预计到港', dataIndex: 'estimated_arrival', width: 120, render: (v: string) => v || '-' },
            { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag> },
            { title: '承运商', dataIndex: 'carrier', width: 100 },
            { title: '费用', dataIndex: 'total_cost', width: 100, render: (v: number, r: any) => `${r.currency || 'USD'} ${v || 0}` },
          ]}
        />
      </Card>
      <Modal title="新建货运单" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={async () => {
        const v = await form.validateFields();
        const api = (window as any).electronAPI; if (!api) return;
        await api.invoke('freight:create', v);
        setModalOpen(false); message.success('货运单已创建'); load();
      }}>
        <Form form={form} layout="vertical">
          <Form.Item name="shipment_ref" label="批次号" rules={[{ required: true }]}><Input /></Form.Item>
          <Space><Form.Item name="transport_mode" label="运输方式" rules={[{ required: true }]}><Select options={[{ label: '海运', value: 'sea' }, { label: '空运', value: 'air' }, { label: '铁路', value: 'rail' }, { label: '卡车', value: 'truck' }]} /></Form.Item>
            <Form.Item name="carrier" label="承运商"><Input /></Form.Item></Space>
          <Space><Form.Item name="origin" label="起运港"><Input /></Form.Item><Form.Item name="destination" label="目的港"><Input /></Form.Item></Space>
          <Space><Form.Item name="container_number" label="柜号"><Input /></Form.Item><Form.Item name="bl_number" label="提单号"><Input /></Form.Item></Space>
          <Space><Form.Item name="estimated_arrival" label="预计到港"><Input placeholder="2024-12-31" /></Form.Item>
            <Form.Item name="total_cost" label="费用"><InputNumber min={0} style={{ width: 120 }} /></Form.Item></Space>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Freight;
