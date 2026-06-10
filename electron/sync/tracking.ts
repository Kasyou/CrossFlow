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

  // Primary: join through product→inventory→warehouse to check warehouse type.
  // Falls back to address-based check when warehouse data is unavailable.
  const shipped = db.prepare(
    `SELECT o.id, o.tracking_number, o.shipped_time, o.shipping_address,
            CASE WHEN COUNT(w.id) = 0 THEN NULL
                 ELSE MIN(CASE WHEN w.type = 'domestic' THEN 0 ELSE 1 END)
            END as has_international
     FROM "order" o
     LEFT JOIN product p ON o.product_id = p.id
     LEFT JOIN inventory i ON p.id = i.product_id
     LEFT JOIN warehouse w ON i.warehouse_id = w.id
     WHERE o.status = 'shipped' AND o.tracking_number IS NOT NULL
     GROUP BY o.id`
  ).all() as any[];

  const results: TrackingStatus[] = [];
  const now = Date.now();

  for (const order of shipped) {
    const shippedDate = new Date(order.shipped_time).getTime();
    const daysInTransit = Math.floor((now - shippedDate) / 86400000);

    const isInternational =
      order.has_international !== null
        ? order.has_international === 1
        : isInternationalByAddress(order.shipping_address);

    let status: TrackingStatus['status'] = 'in_transit';
    if (isInternational) {
      if (daysInTransit > 21) status = 'delayed';
    } else {
      if (daysInTransit > 7) status = 'delayed';
    }

    results.push({
      orderId: order.id,
      trackingNumber: order.tracking_number,
      status,
      daysInTransit,
    });
  }

  return results;
}

function isInternationalByAddress(address: string | null): boolean {
  if (!address) return false;
  const a = address.toLowerCase();
  const countryKeywords = [
    'united states', 'united kingdom', 'germany', 'france', 'spain', 'italy',
    'japan', 'korea', 'australia', 'canada', 'brazil', 'mexico',
    'usa', 'uk', 'eu', 'singapore', 'thailand', 'vietnam', 'indonesia',
    'philippines', 'malaysia', 'india', 'netherlands', 'sweden', 'poland',
  ];
  return countryKeywords.some(kw => a.includes(kw));
}
