/**
 * Merlin Hub SDK v1.0.0
 * ─────────────────────────────────────────────
 * 통합 패키지 진입점
 */

// 1. Core 로직 (API, Auth, Wallet)
export { MerlinHub, configureMerlinHub, getConfig } from './Core';
export { hubFetch, getSessionToken, setSessionToken, clearSessionToken } from './Core/client';
export { checkSession, logout, updateProfile, getProfile } from './Core/auth';
export { getBalance, useCredit, requestKcpPayment } from './Core/wallet';

// 2. Core Hooks (비즈니스 로직 전용)
export { useHubSession } from './Core/useHubSession';
export { useHubAuth } from './Core/useHubAuth';
export { useHubPayment } from './Core/useHubPayment';
export { useHubNotifier } from './Core/useHubNotifier';
export { useHubReferral } from './Core/useHubReferral';

// 3. Custom UI Components (표준 UI 부품)
export { HubProfileWidget } from './Custom/HubProfileWidget';
export { HubAuthModal } from './Custom/HubAuthModal';
export { HubRegisterNudge } from './Custom/HubRegisterNudge';
export { HubPaymentTrigger } from './Custom/HubPaymentTrigger';
export { HubNotifier } from './Custom/HubNotifier';
