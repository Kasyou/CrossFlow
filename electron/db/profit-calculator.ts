// Shared profit calculation — used by both dashboard IPC and CSV export
import { getDbSync } from './connection';

export function getSkuProfit(days = 30) {
  return getDbSync().prepare(
    `SELECT
      o.sku, p.name as productName,
      COUNT(DISTINCT o.id) as orderCount,
      COALESCE(SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1)), 0) as revenue,
      COALESCE(SUM(o.quantity * p.cost_price), 0) as purchaseCost,
      COALESCE(SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1) * fc_comm.rate), 0) as commissionFees,
      COALESCE(SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1) * fc_pay.rate + fc_pay.fixed_amount), 0) as paymentFees,
      COALESCE(SUM(oc.amount * COALESCE(oc_curr.rate_to_usd, 1)), 0) as otherCosts,
      COALESCE(SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1))
        - SUM(o.quantity * p.cost_price)
        - SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1) * COALESCE(fc_comm.rate, 0))
        - SUM(o.total_amount * COALESCE(curr.rate_to_usd, 1) * COALESCE(fc_pay.rate, 0) + COALESCE(fc_pay.fixed_amount, 0))
        - COALESCE(SUM(oc.amount * COALESCE(oc_curr.rate_to_usd, 1)), 0), 0) as estimatedProfit
     FROM "order" o
     JOIN product p ON o.sku = p.sku
     LEFT JOIN currency curr ON o.currency = curr.code
     LEFT JOIN fee_config fc_comm ON o.platform_id = fc_comm.platform_id AND fc_comm.fee_type = 'commission'
     LEFT JOIN fee_config fc_pay ON o.platform_id = fc_pay.platform_id AND fc_pay.fee_type = 'payment'
     LEFT JOIN order_cost oc ON o.id = oc.order_id
     LEFT JOIN currency oc_curr ON oc.currency = oc_curr.code
     WHERE o.order_time >= date('now', ?)
     GROUP BY o.sku ORDER BY estimatedProfit DESC LIMIT 20`
  ).all(`-${days} days`);
}
