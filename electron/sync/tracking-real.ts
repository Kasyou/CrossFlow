// Real logistics tracking via third-party APIs (17TRACK / AfterShip / 快递100)
// Falls back to the warehouse-type-based date heuristic when no API key is configured.

import { getDbSync } from '../db/connection';
import { getStore } from '../store';
import { getSecureSetting } from '../secrets';

interface TrackingResult {
  orderId: string;
  trackingNumber: string;
  status: 'in_transit' | 'delivered' | 'delayed' | 'unknown' | 'exception';
  daysInTransit: number;
  lastEvent: string;
  lastLocation: string;
}

interface TrackingEvent {
  date: string;
  location: string;
  status: string;
  description: string;
}

// ---- API adapters ----

async function query17Track(trackingNumber: string, apiKey: string): Promise<TrackingEvent[]> {
  const res = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', '17token': apiKey },
    body: JSON.stringify([{ number: trackingNumber }]),
  });
  const data = await res.json() as any;
  if (data.code !== 0) throw new Error(`17TRACK error: ${JSON.stringify(data)}`);
  const track = data.data?.accepted?.[0]?.track_info || data.data?.accepted?.[0];
  if (!track) return [];
  return (track.track_list || track.z1 || []).map((e: any) => ({
    date: e.z2 || e.Date || '',
    location: e.z3 || e.Location || '',
    status: e.z4 || e.Status || '',
    description: e.z5 || e.Description || '',
  }));
}

async function queryAfterShip(trackingNumber: string, apiKey: string): Promise<TrackingEvent[]> {
  const res = await fetch(`https://api.aftership.com/v4/trackings/${trackingNumber}`, {
    headers: { 'Content-Type': 'application/json', 'aftership-api-key': apiKey },
  });
  const data = await res.json() as any;
  if (data.meta?.code !== 200) throw new Error(`AfterShip error: ${JSON.stringify(data)}`);
  return (data.data?.tracking?.checkpoints || []).map((e: any) => ({
    date: e.checkpoint_time || '',
    location: e.location || '',
    status: e.tag || '',
    description: e.message || '',
  }));
}

// ---- Main export ----

export async function checkAllTrackingReal(): Promise<TrackingResult[]> {
  const db = getDbSync();

  const shipped = db.prepare(
    `SELECT o.id, o.tracking_number, o.shipped_time, o.shipping_address, o.logistics_provider,
            MIN(CASE WHEN w.type = 'domestic' THEN 0 ELSE 1 END) as is_international
     FROM "order" o
     LEFT JOIN product p ON o.product_id = p.id
     LEFT JOIN inventory i ON p.id = i.product_id
     LEFT JOIN warehouse w ON i.warehouse_id = w.id
     WHERE o.status = 'shipped' AND o.tracking_number IS NOT NULL
     GROUP BY o.id`
  ).all() as any[];

  // Check if tracking API is configured
  const store = getStore();
  const trackingProvider = store.get('trackingProvider', '') as string;
  const trackingApiKey = getSecureSetting('trackingApiKey') || '';

  const results: TrackingResult[] = [];
  const now = Date.now();

  for (const order of shipped) {
    const shippedDate = new Date(order.shipped_time).getTime();
    const daysInTransit = Math.floor((now - shippedDate) / 86400000);
    const isInternational = order.is_international === 1;

    let status: TrackingResult['status'] = 'in_transit';
    let lastEvent = '';
    let lastLocation = '';

    // Try real API if configured
    if (trackingProvider && trackingApiKey) {
      try {
        const events = await queryTracking(order.tracking_number, trackingProvider, trackingApiKey);
        if (events.length > 0) {
          const latest = events[events.length - 1];
          lastEvent = latest.description;
          lastLocation = latest.location;

          // Map API status tags
          const tag = latest.status.toLowerCase();
          if (tag === 'delivered' || tag === 'signed') {
            status = 'delivered';
            // Auto-update order status
            db.prepare('UPDATE "order" SET status = ? WHERE id = ?').run('delivered', order.id);
          } else if (tag === 'exception' || tag === 'returned' || tag === 'failed') {
            status = 'exception';
          } else if (tag.includes('transit') || tag.includes('pending') || tag === 'inforeceived') {
            status = 'in_transit';
          } else {
            status = 'in_transit';
          }
        }
      } catch (err: any) {
        console.warn(`Tracking API failed for ${order.tracking_number}: ${err.message}`);
      }
    }

    // Fall back to heuristic if API didn't provide a definitive status
    if (status === 'in_transit') {
      const threshold = isInternational ? 21 : 7;
      if (daysInTransit > threshold) {
        status = 'delayed';
      }
    }

    results.push({
      orderId: order.id,
      trackingNumber: order.tracking_number,
      status,
      daysInTransit,
      lastEvent,
      lastLocation,
    });
  }

  return results;
}

async function queryTracking(
  trackingNumber: string, provider: string, apiKey: string,
): Promise<TrackingEvent[]> {
  switch (provider) {
    case '17track': return query17Track(trackingNumber, apiKey);
    case 'aftership': return queryAfterShip(trackingNumber, apiKey);
    default: return [];
  }
}
