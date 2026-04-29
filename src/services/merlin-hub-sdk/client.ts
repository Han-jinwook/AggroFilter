/**
 * Merlin Hub SDK — HTTP Client
 * - 모든 허브 통신에 CLIENT_ID/SECRET 헤더를 자동 부착
 * - 네트워크 실패 시 지수 백오프 재시도 (최대 3회)
 * - JWT 401 만료 감지 → 자동 세션 클리어 + 이벤트 발행
 */

import { getConfig } from './config';

const SESSION_TOKEN_KEY = 'merlin_session_token';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// KCP 심사관용 테스트 세션 식별자
export const TEST_SESSION_TOKEN = 'test-session-token';
export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_EMAIL = 'test@aggrofilter.com';
export const TEST_NICKNAME = 'KCP심사관';

/** 현재 localStorage 세션이 KCP 심사용 테스트 세션인지 */
export function isTestSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_TOKEN_KEY) === TEST_SESSION_TOKEN;
}

// ── 세션 토큰 관리 ──

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

/**
 * JWT가 만료(exp) 임박한지 확인 — 만료 60초 전부터 true
 */
export function isTokenExpired(): boolean {
  const token = getSessionToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

// ── 재시도 유틸 ──

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 핵심 Fetch ──

export interface HubFetchResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function getTestSessionMock<T>(path: string, options: RequestInit): Promise<HubFetchResult<T> | null> {
  if (!isTestSession()) return null;

  const method = (options.method || 'GET').toUpperCase();

  // /api/auth/me — 세션 검증
  if (path === '/api/auth/me') {
    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        user: {
          email: TEST_EMAIL,
          userId: TEST_USER_ID,
          id: TEST_USER_ID,
          nickname: TEST_NICKNAME,
          avatar_url: '',
        },
      } as T,
    };
  }

  // /api/wallet/balance — 로컬 잔액 동기화
  if (path.startsWith('/api/wallet/balance')) {
    try {
      // 심사관의 실제 로컬 크레딧을 가져온다 (9999 고정 아님)
      const res = await fetch(`/api/user/credits?userId=${TEST_USER_ID}`, { cache: 'no-store' });
      const data = await res.json();
      return {
        ok: true,
        status: 200,
        data: { balance: typeof data.credits === 'number' ? data.credits : 0, userId: TEST_USER_ID } as T,
      };
    } catch {
      return {
        ok: true,
        status: 200,
        data: { balance: 0, userId: TEST_USER_ID } as T,
      };
    }
  }

  // /api/wallet/use — 차감 (프론트 호출 시)
  // 프론트엔드에서 강제 차감은 하지 않고, 서버(route.ts)에서 t_credit_history를 통해 차감됨.
  // 여기서는 최신 잔액만 반환해서 헤더 업데이트 유도.
  if (path === '/api/wallet/use' && method === 'POST') {
    try {
      const res = await fetch(`/api/user/credits?userId=${TEST_USER_ID}`, { cache: 'no-store' });
      const data = await res.json();
      return {
        ok: true,
        status: 200,
        data: { success: true, balance: data.credits || 0 } as T,
      };
    } catch {
      return {
        ok: true,
        status: 200,
        data: { success: true, balance: 0 } as T,
      };
    }
  }

  // /api/auth/profile — 프로필 갱신
  if (path === '/api/auth/profile') {
    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        nickname: TEST_NICKNAME,
        avatar_url: '',
      } as T,
    };
  }

  // 그 외 허브 API
  return {
    ok: true,
    status: 200,
    data: {} as T,
  };
}

export async function hubFetch<T = any>(
  path: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<HubFetchResult<T>> {
  // KCP 심사관 테스트 세션 차단 — 허브 호출 우회
  const mock = await getTestSessionMock<T>(path, options);
  if (mock) return mock;

  const config = getConfig();
  const url = `${config.hubUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': config.clientId,
    'X-Client-Secret': config.clientSecret,
    ...(options.headers as Record<string, string> || {}),
  };

  // 세션 토큰이 있으면 Authorization 헤더 추가
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      // 401 → JWT 만료 — 세션 클리어 후 이벤트 발행
      if (res.status === 401) {
        clearSessionToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('merlinSessionExpired'));
        }
        return { ok: false, status: 401, data: data as T };
      }

      // 5xx 서버 오류 → 재시도 대상
      if (res.status >= 500 && attempt < retries - 1) {
        await wait(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }

      return { ok: res.ok, status: res.status, data: data as T };
    } catch (err) {
      lastError = err as Error;
      // 네트워크 오류(ECONNREFUSED 등) → 재시도
      if (attempt < retries - 1) {
        await wait(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  console.error('[MerlinHub] hubFetch failed after retries:', path, lastError);
  return { ok: false, status: 0, data: { error: '허브 서버 연결 실패' } as any };
}
