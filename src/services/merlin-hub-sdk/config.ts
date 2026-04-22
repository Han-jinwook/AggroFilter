/**
 * Merlin Hub SDK — Configuration
 * 싱글턴 패턴: 한 번 초기화 후 전역에서 재사용
 */

export interface MerlinHubConfig {
  hubUrl: string;
  clientId: string;
  clientSecret: string;
}

const DEFAULT_CONFIG: MerlinHubConfig = {
  hubUrl: process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://merlinfamilyos.onrender.com',
  clientId: process.env.MERLIN_HUB_CLIENT_ID || process.env.NEXT_PUBLIC_MERLIN_CLIENT_ID || 'APP-01',
  clientSecret: process.env.MERLIN_HUB_CLIENT_SECRET || process.env.NEXT_PUBLIC_MERLIN_CLIENT_SECRET || 'agro-secret-key-777-v1',
};

let _config: MerlinHubConfig = { ...DEFAULT_CONFIG };

export function configureMerlinHub(overrides: Partial<MerlinHubConfig>) {
  _config = { ..._config, ...overrides };
}

export function getConfig(): Readonly<MerlinHubConfig> {
  return _config;
}
