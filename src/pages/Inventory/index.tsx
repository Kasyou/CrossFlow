import React, { useEffect, useState } from 'react';
import { Card, Typography, Row, Col, Button, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { IPC } from '../../shared/ipc-channels';
import { useInventoryStore } from '../../stores/inventory-store';
import StockAlert from '../../components/inventory/StockAlert';
import WarehouseCard from '../../components/inventory/WarehouseCard';
import InventoryTable from '../../components/inventory/InventoryTable';

const { Title, Text } = Typography;

const Inventory: React.FC = () => {
  const { loadAll, loadLowStock, loadWarehouses, warehouses } = useInventoryStore();
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [whEditing, setWhEditing] = useState<any>(null);
  const [whForm] = Form.useForm();

  useEffect(() => {
    loadAll();
    loadLowStock();
    loadWarehouses();
  }, []);

  const handleWhSave = async () => {
    const values = await whForm.validateFields();
    const api = (window as any).electronAPI;
    if (!api) return;
    if (whEditing) {
      await api.invoke(IPC.WAREHOUSE_UPDATE, whEditing.id, { name: values.name, country: values.country });
      message.success('仓库已更新');
    } else {
      await api.invoke(IPC.WAREHOUSE_CREATE, values.name, values.type, values.country || '');
      message.success('仓库已创建');
    }
    setWhModalOpen(false);
    loadWarehouses();
    loadAll();
  };

  const handleWhDelete = async (id: string) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    Modal.confirm({
      title: '确认删除',
      content: '删除仓库将同时删除该仓库下的所有库存记录。',
      onOk: async () => {
        await api.invoke(IPC.WAREHOUSE_DELETE, id);
        message.success('仓库已删除');
        loadWarehouses();
        loadAll();
      },
    });
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>库存管理</Title>
      <StockAlert />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>仓库概览</Text>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setWhEditing(null); whForm.resetFields(); setWhModalOpen(true); }}>
          添加仓库
        </Button>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {warehouses.map((w) => (
          <Col span={8} key={w.id}>
            <div style={{ position: 'relative' }}>
              <WarehouseCard warehouse={w} />
              <div style={{ position: 'absolute', top: 8, right: 8 }}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setWhEditing(w); whForm.setFieldsValue(w); setWhModalOpen(true); }} />
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleWhDelete(w.id)} />
              </div>
            </div>
          </Col>
        ))}
        {warehouses.length === 0 && (
          <Col span={24}><Text type="secondary">暂无仓库，请点击"添加仓库"创建</Text></Col>
        )}
      </Row>
      <Card title="库存明细">
        <InventoryTable />
      </Card>

      <Modal
        title={whEditing ? '编辑仓库' : '添加仓库'}
        open={whModalOpen}
        onCancel={() => setWhModalOpen(false)}
        onOk={handleWhSave}
      >
        <Form form={whForm} layout="vertical">
          <Form.Item name="name" label="仓库名称" rules={[{ required: true, message: '请输入仓库名称' }]}>
            <Input placeholder="例如：广州仓、FBA美东" />
          </Form.Item>
          <Form.Item name="type" label="仓库类型" rules={[{ required: true, message: '请选择仓库类型' }]}>
            <Select options={[
              { label: '国内仓', value: 'domestic' },
              { label: 'FBA仓', value: 'fba' },
              { label: '海外仓(第三方)', value: 'overseas' },
            ]} />
          </Form.Item>
          <Form.Item name="country" label="所在国家">
            <Input placeholder="例如：中国、美国" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
