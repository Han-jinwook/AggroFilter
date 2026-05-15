'use client';

/**
 * Merlin Hub SDK v1.0.0
 * ─────────────────────────────────────────────
 * [CLIENT ONLY] 리액트 전용 엔트리
 * 이 파일은 클라이언트 컴포넌트에서만 임포트해야 합니다.
 */

// 1. Core Hooks (비즈니스 로직)
export { useHubSession } from './Core/useHubSession';
export { useHubAuth } from './Core/useHubAuth';
export { useHubPayment } from './Core/useHubPayment';
export { useHubNotifier } from './Core/useHubNotifier';
export { useHubReferral } from './Core/useHubReferral';

// 2. Custom UI Components (표준 UI 부품)
export { HubProfileWidget } from './Custom/HubProfileWidget';
export { HubAuthModal } from './Custom/HubAuthModal';
export { HubRegisterNudge } from './Custom/HubRegisterNudge';
export { HubPaymentTrigger } from './Custom/HubPaymentTrigger';
export { HubNotifier, showToast } from './Custom/HubNotifier';
export { HubReferralWidget } from './Custom/HubReferralWidget';
