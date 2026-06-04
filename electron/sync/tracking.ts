// Logistics tracking service
// In V1, this tracks shipment status by checking if orders with tracking numbers have exceeded expected delivery time

import { getDbSync } from '../db/connection';

interface TrackingStatus {
  orderId: string;
  trackingNumber: string;
  status: 'in_transit' | 'delivered' | 'delayed' | 'unknown';
  daysInTransit: number;
}

export function checkAllTracking(): TrackingStatus[] {
  const db = getDbSync();
  const shipped = db.prepare(
    `SELECT id, tracking_number, shipped_time FROM "order" WHERE status = 'shipped' AND tracking_number IS NOT NULL`
  ).all() as any[];

  const results: TrackingStatus[] = [];
  const now = Date.now();

  for (const order of shipped) {
    const shippedDate = new Date(order.shipped_time).getTime();
    const daysInTransit = Math.floor((now - shippedDate) / 86400000);

    let status: TrackingStatus['status'] = 'in_transit';
    // Simple rule-based tracking:
    // - Domestic (7 days): > 7 days = delayed, > 10 suggested delivery
    // - International (21 days): > 21 days = delayed, > 30 suggested delivery
    if (daysInTransit > 30) {
      status = 'delayed';
    } else if (daysInTransit > 14) {
      status = 'delayed'; // conservative threshold
    }

    results.push({
      orderId: order.id,
      trackingNumber: order.tracking_number,
      status,
      daysInTransit,
    });
  }

  // Auto-mark as delivered for very old shipped orders
  db.prepare(
    `UPDATE "order" SET status = 'delivered' WHERE status = 'shipped' AND shipped_time < date('now', '-60 days')`
  ).run();

  return results;
}
