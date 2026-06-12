// Exchange rate sync — fetches rates from exchangerate-api.com (free tier, no key needed for base USD)
// Updates the currency table and logs each fetch.

import { getDbSync } from '../db/connection';
import { v4 as uuid } from 'uuid';

async function fetchRates(base: string): Promise<Record<string, number>> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  const data = await res.json() as any;
  if (data.result !== 'success') throw new Error(`Exchange rate API error: ${data['error-type'] || 'unknown'}`);
  return data.rates;
}

export async function syncExchangeRates(): Promise<{ updated: number; message: string }> {
  const db = getDbSync();
  try {
    const rates = await fetchRates('USD');
    const source = 'open.er-api.com';

    for (const [code, rate] of Object.entries(rates)) {
      const exists = db.prepare('SELECT code FROM currency WHERE code = ?').get(code) as any;
      if (exists) {
        db.prepare('UPDATE currency SET rate_to_usd = ?, updated_at = datetime(\'now\') WHERE code = ?')
          .run(rate, code);
      }
      // Log each fetch for audit
      db.prepare(
        'INSERT INTO exchange_rate_log (id, from_code, to_code, rate, source, fetched_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
      ).run(uuid(), 'USD', code, rate, source);
    }

    return { updated: Object.keys(rates).length, message: `Updated ${Object.keys(rates).length} currency rates` };
  } catch (err: any) {
    return { updated: 0, message: `Exchange rate sync failed: ${err.message}` };
  }
}

export function convertCurrency(amount: number, from: string, to: string): number {
  const db = getDbSync();
  const fromRate = (db.prepare('SELECT rate_to_usd FROM currency WHERE code = ?').get(from) as any)?.rate_to_usd || 1;
  const toRate = (db.prepare('SELECT rate_to_usd FROM currency WHERE code = ?').get(to) as any)?.rate_to_usd || 1;
  return amount * fromRate / toRate;
}
