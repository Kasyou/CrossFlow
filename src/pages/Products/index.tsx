import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TranslationOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useProductStore } from '../../stores/product-store';
import { IPC } from '../../shared/ipc-channels';
import type { Product } from '../../types/product';

const { Title } = Typography;

const categoryOptions = [
  { label: '电子产品', value: '电子产品' },
  { label: '手机配件', value: '手机配件' },
  { label: '数据线', value: '数据线' },
  { label: '充电器', value: '充电器' },
  { label: '家居', value: '家居' },
  { label: '宠物用品', value: '宠物用品' },
  { label: '车载配件', value: '车载配件' },
  { label: '手表配件', value: '手表配件' },
];

const Products: React.FC = () => {
  const { products, loading, loadProducts, createProduct, updateProduct, deleteProduct } = useProductStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { loadProducts(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateProduct(editing.sku, values);
      message.success('商品已更新');
    } else {
      await createProduct(values);
      message.success('商品已创建');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleDelete = async (sku: string) => {
    await deleteProduct(sku);
    message.success('商品已删除');
  };

  const columns: ColumnsType<Product> = [
    { title: 'SKU', dataIndex: 'sku', width: 140 },
    { title: '商品名称', dataIndex: 'name', width: 180, ellipsis: true },
    { title: '英文名称', dataIndex: 'nameEn', width: 200, ellipsis: true, render: (v) => v || '-' },
    { title: '分类', dataIndex: 'category', width: 100, render: (v) => v || '-' },
    { title: '采购成本', dataIndex: 'costPrice', width: 100, render: (v) => `¥${v.toFixed(2)}` },
    { title: '重量(kg)', dataIndex: 'weightKg', width: 80 },
    { title: '安全库存', dataIndex: 'safetyStock', width: 80 },
    {
      title: '操作', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title="确认删除此商品？" onConfirm={() => handleDelete(record.sku)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>商品管理</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          添加商品
        </Button>
      </div>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={products} loading={loading}
          pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 个SKU` }}
          locale={{ emptyText: '暂无商品，点击"添加商品"开始' }} />
      </Card>

      <Modal
        title={editing ? '编辑商品' : '添加商品'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={handleSave}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sku" label="SKU编码" rules={[{ required: true }]}>
            <Input placeholder="例如：BT-EP10-BK" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="商品名称(中文)" rules={[{ required: true }]}>
            <Input placeholder="例如：蓝牙耳机Pro" />
          </Form.Item>
          <Form.Item name="name_en" label="商品名称(英文)">
            <Input placeholder="例如：Bluetooth Earbuds Pro" />
          </Form.Item>
          <Form.Item label=" ">
            <Button
              icon={<TranslationOutlined />}
              onClick={async () => {
                const cnName = form.getFieldValue('name');
                if (!cnName) { message.warning('请先填写中文名称'); return; }
                const api = (window as any).electronAPI;
                if (!api) { message.warning('AI翻译功能仅支持在Electron应用中运行'); return; }
                message.loading({ content: '正在翻译...', key: 'translate' });
                try {
                  const result = await api.invoke(IPC.AI_TRANSLATE, cnName);
                  form.setFieldsValue({ name_en: result });
                  message.success({ content: '翻译完成', key: 'translate' });
                } catch {
                  message.error({ content: '翻译失败，请检查AI配置', key: 'translate' });
                }
              }}
            >
              AI翻译为英文
            </Button>
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select options={categoryOptions} placeholder="选择分类" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="cost_price" label="采购成本(¥)">
              <InputNumber min={0} step={0.01} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="weight_kg" label="重量(kg)">
              <InputNumber min={0} step={0.01} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="safety_stock" label="安全库存">
              <InputNumber min={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
