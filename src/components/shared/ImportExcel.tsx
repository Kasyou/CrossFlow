import React, { useState } from 'react';
import { Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { IPC } from '../../shared/ipc-channels';

const ImportExcel: React.FC<{ platformCode: string; platformName: string; onImported: () => void }> = ({ platformCode, platformName, onImported }) => {
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const api = (window as any).electronAPI;
      if (!api) { message.error('导入功能仅支持在 Electron 应用中运行'); setImporting(false); return false; }
      const filePath = api.getPathForFile(file);
      const result = await api.invoke(IPC.ORDERS_IMPORT_EXCEL, filePath, platformCode);
      message.success(`导入完成：${result.message || `新增${result.orders?.length || 0}条订单`}`);
      onImported();
    } catch (err: any) {
      message.error(`导入失败：${err.message}`);
    } finally {
      setImporting(false);
    }
    return false;
  };

  return (
    <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls">
      <Button icon={<UploadOutlined />} loading={importing}>从{platformName}导入Excel订单</Button>
    </Upload>
  );
};

export default ImportExcel;
