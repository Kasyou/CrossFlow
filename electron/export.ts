// Data export utilities — CSV generation for reports

import { getDbSync } from './db/connection';
import { getSkuProfit } from './db/profit-calculator';

function toCSV(columns: string[], rows: any[]): string {
  // UTF-8 BOM for Excel Chinese character support
  const BOM = '﻿';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      let str = String(val);
      // CSV injection prevention: prefix = + - @ with single quote
      if (/^[=+\-@]/.test(str)) str = "'" + str;
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  ).join('\n');
  return BOM + header + '\n' + body;
}

export function exportOrders(filter?: { dateFrom?: string; dateTo?: string; platform_id?: string }): string {
  const db = getDbSync();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter?.dateFrom) { conditions.push('o.order_time >= ?'); params.push(filter.dateFrom); }
  if (filter?.dateTo) { conditions.push('o.order_time <= ?'); params.push(filter.dateTo); }
  if (filter?.platform_id) { conditions.push('o.platform_id = ?'); params.push(filter.platform_id); }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const rows = db.prepare(
    `SELECT o.platform_order_id, o.sku, o.quantity, o.unit_price, o.currency, o.total_amount,
            o.buyer_name, o.status, o.order_time, p.name as platform_name
     FROM "order" o LEFT JOIN platform p ON o.platform_id = p.id ${where} ORDER BY o.order_time DESC`
  ).all(...params);
  return toCSV(['platform_order_id', 'sku', 'quantity', 'unit_price', 'currency', 'total_amount', 'buyer_name', 'status', 'order_time', 'platform_name'], rows);
}

export function exportInventory(): string {
  const rows = getDbSync().prepare(
    `SELECT p.sku, p.name as product_name, w.name as warehouse_name, w.type as warehouse_type,
            i.available, i.reserved, i.in_transit, p.safety_stock, i.updated_at
     FROM inventory i
     JOIN product p ON i.product_id = p.id
     JOIN warehouse w ON i.warehouse_id = w.id
     ORDER BY (i.available + i.reserved + i.in_transit) ASC`
  ).all();
  return toCSV(['sku', 'product_name', 'warehouse_name', 'warehouse_type', 'available', 'reserved', 'in_transit', 'safety_stock', 'updated_at'], rows);
}

export function exportProfitReport(days: number = 30): string {
  const rows = getSkuProfit(days);
  return toCSV(['sku', 'productName', 'orderCount', 'revenue', 'purchaseCost', 'commissionFees', 'paymentFees', 'otherCosts', 'estimatedProfit'], rows);
}
