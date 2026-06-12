import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, InputNumber, Space, Tag, message, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useProcurementStore } from '../../stores/procurement-store';

const { Title } = Typography;

const Procurement: React.FC = () => {
  const { suppliers, purchaseOrders, loading, loadSuppliers, loadPOs, createSupplier, deleteSupplier, createPO, updatePOStatus } = useProcurementStore();
  const [supModal, setSupModal] = useState(false);
  const [poModal, setPoModal] = useState(false);
  const [supForm] = Form.useForm();
  const [poForm] = Form.useForm();

  useEffect(() => { loadSuppliers(); loadPOs(); }, []);

  const statusColor: Record<string, string> = { draft: 'default', confirmed: 'blue', shipped: 'gold', received: 'green', cancelled: 'red' };

  return (
    <div>
      <Title level={3} style={{ margin: 0, marginBottom: 16 }}>采购管理</Title>
      <Tabs items={[
        {
          key: 'po', label: '采购单',
          children: (
            <Card extra={<Button icon={<PlusOutlined />} onClick={() => { poForm.resetFields(); setPoModal(true); }}>新建采购单</Button>}>
              <Table rowKey="id" size="small" loading={loading} dataSource={purchaseOrders}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', width: 120 },
                  { title: '金额', dataIndex: 'total_amount', width: 100, render: (v: number) => `$${v.toFixed(2)}` },
                  { title: '项数', dataIndex: 'item_count', width: 60 },
                  { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag> },
                  { title: '时间', dataIndex: 'created_at', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
                  { title: '操作', width: 200, render: (_: any, r: any) => (
                    <Space size="small">
                      {r.status === 'draft' && <Button size="small" onClick={async () => { await updatePOStatus(r.id, 'confirmed'); message.success('已确认'); }}>确认</Button>}
                      {r.status === 'confirmed' && <Button size="small" type="primary" onClick={async () => { await updatePOStatus(r.id, 'shipped'); message.success('已发货'); }}>发货</Button>}
                      {(r.status === 'shipped' || r.status === 'confirmed') && <Button size="small" style={{ color: 'green' }} onClick={async () => { await updatePOStatus(r.id, 'received'); message.success('已收货，库存已更新'); loadSuppliers(); }}>收货</Button>}
                    </Space>
                  )},
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'supplier', label: '供应商',
          children: (
            <Card extra={<Button icon={<PlusOutlined />} onClick={() => { supForm.resetFields(); setSupModal(true); }}>添加供应商</Button>}>
              <Table rowKey="id" size="small" dataSource={suppliers}
                columns={[
                  { title: '名称', dataIndex: 'name', width: 140 }, { title: '联系人', dataIndex: 'contact', width: 100 },
                  { title: '邮箱', dataIndex: 'email', width: 160 }, { title: '交期(天)', dataIndex: 'lead_time_days', width: 80 },
                  { title: 'MOQ', dataIndex: 'moq', width: 60 }, { title: '付款条款', dataIndex: 'payment_terms', width: 100 },
                  { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" danger icon={<DeleteOutlined />} onClick={async () => { await deleteSupplier(r.id); message.success('已删除'); }} /> },
                ]}
              />
            </Card>
          ),
        },
      ]} />

      <Modal title="添加供应商" open={supModal} onCancel={() => setSupModal(false)} onOk={async () => { const v = await supForm.validateFields(); await createSupplier(v); setSupModal(false); message.success('供应商已添加'); }}>
        <Form form={supForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Space><Form.Item name="contact" label="联系人"><Input /></Form.Item><Form.Item name="email" label="邮箱"><Input /></Form.Item></Space>
          <Space><Form.Item name="lead_time_days" label="交期(天)"><InputNumber min={1} /></Form.Item><Form.Item name="moq" label="MOQ"><InputNumber min={1} /></Form.Item></Space>
          <Form.Item name="payment_terms" label="付款条款"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新建采购单" open={poModal} onCancel={() => setPoModal(false)} onOk={async () => {
        const v = await poForm.validateFields();
        const items = (v.items || []).map((i: any) => ({ sku: i.sku, quantity: i.quantity || 1, unit_cost: i.unit_cost || 0 }));
        await createPO(v.supplier_id, items);
        setPoModal(false); message.success('采购单已创建');
      }} width={500}>
        <Form form={poForm} layout="vertical">
          <Form.Item name="supplier_id" label="供应商ID" rules={[{ required: true }]}><Input placeholder="从供应商列表复制ID" /></Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (<>{fields.map(({ key, name }) => (<Space key={key}><Form.Item name={[name, 'sku']} rules={[{ required: true }]}><Input placeholder="SKU" /></Form.Item><Form.Item name={[name, 'quantity']}><InputNumber placeholder="数量" min={1} /></Form.Item><Form.Item name={[name, 'unit_cost']}><InputNumber placeholder="单价" min={0} /></Form.Item><Button icon={<DeleteOutlined />} onClick={() => remove(name)} /></Space>))}<Button type="dashed" onClick={() => add()} block>+ 添加商品</Button></>)}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default Procurement;
