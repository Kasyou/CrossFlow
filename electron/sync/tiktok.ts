import { PlatformRow } from '../db/repositories/platform-repo';

export async function syncTikTokOrders(_platform: PlatformRow): Promise<{ orders: any[]; message?: string }> {
  return {
    orders: [],
    message: 'TikTok Shop has no public API. Use the in-app browser login or Excel import.'
  };
}
