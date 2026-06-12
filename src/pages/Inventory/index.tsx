import React, { useEffect, useState } from 'react';
import { Card, Typography, Row, Col, Button, Modal, Form, Input, Select, message, Table, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { IPC } from '../../shared/ipc-channels';
import { useInventoryStore } from '../../stores/inventory-store';
import { useWarehouseStore } from '../../stores/warehouse-store';
import StockAlert from '../../components/inventory/StockAlert';
import WarehouseCard from '../../components/inventory/WarehouseCard';
import InventoryTable from '../../components/inventory/InventoryTable';

const { Title, Text } = Typography;

const Inventory: React.FC = () => {
  const { loadAll, loadLowStock } = useInventoryStore();
  const { warehouses, loadWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } = useWarehouseStore();
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [whEditing, setWhEditing] = useState<any>(null);
  const [whForm] = Form.useForm();
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const loadSuggestions = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.invoke(IPC.INVENTORY_RESTOCK_SUGGESTIONS);
    setSuggestions(result || []);
  };

  useEffect(() => {
    loadAll();
    loadLowStock();
    loadWarehouses();
    loadSuggestions();
  }, []);

  const handleWhSave = async () => {
    const values = await whForm.validateFields();
    if (whEditing) {
      await updateWarehouse(whEditing.id, { name: values.name, country: values.country });
      message.success('仓库已更新');
    } else {
      await createWarehouse(values.name, values.type, values.country || '');
      message.success('仓库已创建');
    }
    setWhModalOpen(false);
    loadAll();
  };

  const handleWhDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除仓库将同时删除该仓库下的所有库存记录。',
      onOk: async () => {
        await deleteWarehouse(id);
        message.success('仓库已删除');
        loadAll();
      },
    });
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>库存管理</Title>
      <StockAlert />
      {suggestions.length > 0 && (
        <Card title="智能补货建议" size="small" style={{ marginBottom: 16 }}>
          <Table
            rowKey="sku"
            size="small"
            pagination={false}
            dataSource={suggestions}
            columns={[
              { title: 'SKU', dataIndex: 'sku', width: 120 },
              { title: '商品', dataIndex: 'product_name', width: 140, ellipsis: true },
              { title: '仓库', dataIndex: 'warehouse_name', width: 90 },
              { title: '可售', dataIndex: 'available', width: 60, render: (v: number) => <Text type={v === 0 ? 'danger' : 'warning'}>{v}</Text> },
              { title: '在途', dataIndex: 'in_transit', width: 60 },
              { title: '日均销量', dataIndex: 'avg_daily_sales', width: 80, render: (v: number) => v.toFixed(1) },
              { title: '建议补货', dataIndex: 'suggested_restock_qty', width: 90, render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
              { title: '紧急度', dataIndex: 'urgency', width: 80, render: (v: string) => {
                const map: Record<string, { color: string; text: string }> = { urgent: { color: 'red', text: '紧急' }, high: { color: 'orange', text: '高' }, normal: { color: 'blue', text: '普通' } };
                return <Tag color={map[v]?.color}>{map[v]?.text || v}</Tag>;
              }},
              { title: '操作', width: 80, render: (_: any, record: any) => (
                <Button size="small" type="primary" onClick={async () => {
                  const api = (window as any).electronAPI;
                  if (!api) return;
                  await api.invoke(IPC.INVENTORY_RESTOCK, record.product_id, record.warehouse_id, record.suggested_restock_qty, '智能建议补货');
                  message.success(`已添加补货单：${record.sku} x ${record.suggested_restock_qty}`);
                  await loadAll();
                  await loadLowStock();
                  await loadSuggestions();
                }}>一键补货</Button>
              )},
            ]}
          />
        </Card>
      )}
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
