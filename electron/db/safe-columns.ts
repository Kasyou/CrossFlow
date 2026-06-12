// Safe column mapping: prevents SQL injection via dynamic column names.
// Only whitelisted columns are allowed in UPDATE SET clauses.
// Unknown columns are silently dropped with a dev-mode warning.

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

export function buildSetClauses(
  fields: Record<string, unknown>,
  allowed: string[],
): { clauses: string[]; values: unknown[] } {
  const allowedSet = new Set(allowed);
  const clauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (!allowedSet.has(key)) {
      if (isDev) console.warn(`[safe-columns] Dropped unknown column: "${key}". Allowed: ${allowed.join(', ')}`);
      continue;
    }
    clauses.push(`${key} = ?`);
    values.push(val);
  }

  return { clauses, values };
}

// Column whitelists per table
export const PRODUCT_COLUMNS = ['name', 'name_en', 'image_url', 'category', 'cost_price', 'weight_kg', 'safety_stock'];
export const WAREHOUSE_COLUMNS = ['name', 'type', 'country', 'is_default'];
export const SUPPLIER_COLUMNS = ['name', 'contact', 'email', 'phone', 'lead_time_days', 'moq', 'payment_terms', 'notes'];
