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

export async function hubFetch<T = any>(
  path: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<HubFetchResult<T>> {
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
