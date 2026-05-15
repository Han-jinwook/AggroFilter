/**
 * Merlin Hub SDK v1.0.0
 * ─────────────────────────────────────────────
 * [SERVER SAFE] 공통 및 서버 전용 엔트리
 * 이 파일은 서버 컴포넌트 및 API Route에서도 안전하게 임포트할 수 있습니다.
 */

// 1. Core 로직 (API, Auth, Wallet) - 서버/클라이언트 공용
export { MerlinHub, configureMerlinHub, getConfig } from './Core';
export { hubFetch, getSessionToken, setSessionToken, clearSessionToken } from './Core/client';
export { checkSession, logout, updateProfile, getProfile } from './Core/auth';
export { getBalance, useCredit, requestKcpPayment } from './Core/wallet';

// ⚠️ 중요: useHubAuth, HubProfileWidget 등의 React 의존성 부품은 
// 서버 빌드 에러 방지를 위해 여기서 익스포트하지 않습니다.
// 대신 '@/src/services/merlin-hub-sdk/react' 에서 가져오세요.
