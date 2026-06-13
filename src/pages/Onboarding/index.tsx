import React, { useState } from 'react';
import { Steps, Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    {
      title: '欢迎使用 CrossFlow',
      content: (
        <Result
          status="success"
          title="跨境电商工作流管理，轻松上手"
          subTitle="帮助中小型跨境电商企业管理多平台订单和库存，把每天2小时的多平台操作压缩到15分钟。"
        />
      ),
    },
    {
      title: '配置平台授权',
      content: (
        <Result
          icon={<span style={{ fontSize: 72 }}>🔌</span>}
          title="连接您的电商平台"
          subTitle="前往设置页面，为 Amazon、TikTok Shop、Temu、Shopee 等平台配置API授权或导入Excel订单。"
          extra={<Button type="primary" onClick={() => navigate('/settings')}>前往设置</Button>}
        />
      ),
    },
    {
      title: '添加商品和仓库',
      content: (
        <Result
          icon={<span style={{ fontSize: 72 }}>📦</span>}
          title="录入商品和仓库信息"
          subTitle="在商品管理页面添加您的SKU，在库存管理页面配置仓库。设置安全库存线以接收预警通知。"
          extra={<Button type="primary" onClick={() => navigate('/products')}>前往商品管理</Button>}
        />
      ),
    },
    {
      title: '开始使用',
      content: (
        <Result
          status="success"
          title="一切就绪！"
          subTitle="现在可以查看仪表盘、处理订单、管理库存了。系统将在后台自动同步各平台订单。"
          extra={<Button type="primary" onClick={() => navigate('/dashboard')}>进入仪表盘</Button>}
        />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 0' }}>
      <Steps current={step} items={steps.map(s => ({ title: s.title }))} />
      <div style={{ marginTop: 48, minHeight: 300 }}>
        {steps[step].content}
      </div>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        {step > 0 && (
          <Button style={{ marginRight: 8 }} onClick={() => setStep(step - 1)}>上一步</Button>
        )}
        {step < steps.length - 1 && (
          <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>
        )}
        <Button type="link" onClick={() => navigate('/dashboard')} style={{ marginLeft: 16 }}>跳过引导</Button>
      </div>
    </div>
  );
};

export default Onboarding;
