export interface PlatformConfig {
  id: string;
  code: 'amazon' | 'tiktok' | 'temu' | 'shopee' | 'lazada';
  name: string;
  authConfigured: boolean;
  syncEnabled: boolean;
  syncInterval: number;
}

export type PlatformCode = PlatformConfig['code'];
