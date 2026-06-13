import { registerOrdersHandlers } from './handlers/orders';
import { registerInventoryHandlers } from './handlers/inventory';
import { registerProductsPlatformHandlers } from './handlers/products-platform';
import { registerDashboardHandlers } from './handlers/dashboard';
import { registerBusinessHandlers } from './handlers/business';

export function registerIpcHandlers(): void {
  registerOrdersHandlers();
  registerInventoryHandlers();
  registerProductsPlatformHandlers();
  registerDashboardHandlers();
  registerBusinessHandlers();
}
