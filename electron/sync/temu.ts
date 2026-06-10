import * as XLSX from 'xlsx';
import fs from 'fs';
import { v4 as uuid } from 'uuid';

function safeInt(val: unknown, fallback = 1): number {
  const n = parseInt(String(val ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function safeFloat(val: unknown, fallback = 0): number {
  const n = parseFloat(String(val ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export function importTemuExcel(filePath: string): { orders: any[]; message: string } {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  const orders = rows.map((row: any) => ({
    platform_order_id: row['订单号'] || row['Order ID'] || uuid(),
    sku: row['SKU'] || row['商品SKU'] || '',
    quantity: safeInt(row['数量'] ?? row['Quantity'], 1),
    unit_price: safeFloat(row['单价'] ?? row['Unit Price'], 0),
    currency: 'USD',
    total_amount: safeFloat(row['金额'] ?? row['Amount'], 0),
    buyer_name: row['收货人'] || row['Buyer'] || null,
    shipping_address: row['收货地址'] || row['Shipping Address'] || null,
    status: 'pending',
    platform_status: row['状态'] || row['Status'] || '待发货',
    order_time: row['下单时间'] || row['Order Time'] || new Date().toISOString(),
  }));

  return { orders, message: `Parsed ${orders.length} orders from Excel` };
}
