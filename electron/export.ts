// Data export utilities — CSV generation for reports

import { getDbSync } from './db/connection';

function toCSV(columns: string[], rows: any[]): string {
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
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
  const rows = getDbSync().prepare(
    `SELECT o.sku, p.name as productName, COUNT(DISTINCT o.id) as orderCount,
            COALESCE(SUM(o.total_amount), 0) as revenue,
            COALESCE(SUM(o.quantity * p.cost_price), 0) as purchaseCost,
            COALESCE(SUM(o.total_amount * fc_comm.rate), 0) as commissionFees,
            COALESCE(SUM(o.total_amount * fc_pay.rate + fc_pay.fixed_amount), 0) as paymentFees,
            COALESCE(SUM(o.total_amount) - SUM(o.quantity * p.cost_price)
              - SUM(o.total_amount * COALESCE(fc_comm.rate, 0))
              - SUM(o.total_amount * COALESCE(fc_pay.rate, 0) + COALESCE(fc_pay.fixed_amount, 0)), 0) as estimatedProfit
     FROM "order" o
     JOIN product p ON o.sku = p.sku
     LEFT JOIN fee_config fc_comm ON o.platform_id = fc_comm.platform_id AND fc_comm.fee_type = 'commission'
     LEFT JOIN fee_config fc_pay ON o.platform_id = fc_pay.platform_id AND fc_pay.fee_type = 'payment'
     WHERE o.order_time >= date('now', ?)
     GROUP BY o.sku ORDER BY estimatedProfit DESC`
  ).all(`-${days} days`);
  return toCSV(['sku', 'productName', 'orderCount', 'revenue', 'purchaseCost', 'commissionFees', 'paymentFees', 'estimatedProfit'], rows);
}
