/**
 * Merlin Hub SDK
 * ─────────────────────────────────────────────
 * 싱글턴 패턴 SDK — 다른 패밀리 앱에서도 복사하여 재사용 가능
 */

export { configureMerlinHub, getConfig } from './config';
export type { MerlinHubConfig } from './config';

export { 
  hubFetch, 
  getSessionToken, 
  setSessionToken, 
  clearSessionToken, 
  isTokenExpired,
  MerlinHubClient,
  TEST_SESSION_TOKEN,
  TEST_USER_ID,
  TEST_EMAIL,
  TEST_NICKNAME
} from './client';
export type { HubFetchResult } from './client';

export { 
  requestOTP, 
  verifyOTP, 
  checkSession, 
  logout, 
  updateProfile, 
  getProfile 
} from './auth';
export type { OTPRequestResult, OTPVerifyResult, ProfileUpdateParams, ProfileResult, SessionResult } from './auth';

export { 
  getBalance, 
  getUserId, 
  useCredit, 
  getPricing, 
  processTransaction, 
  chargeDynamic, 
  getHistory,
  requestKcpPayment 
} from './wallet';
export type { WalletBalance } from './wallet';

// ── Namespace export for convenience ──
import * as auth from './auth';
import * as wallet from './wallet';
import * as client from './client';
import { configureMerlinHub, getConfig } from './config';

export const MerlinHub = {
  configure: configureMerlinHub,
  getConfig,
  auth,
  wallet,
  client,
} as const;
