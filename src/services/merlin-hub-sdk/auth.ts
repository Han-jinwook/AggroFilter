/**
 * Merlin Hub SDK — Auth Module
 * 이메일 OTP 인증: requestOTP → verifyOTP → JWT 저장
 * 프로필 관리: updateProfile → Hub family_users 직접 갱신
 */

import { hubFetch, setSessionToken, clearSessionToken, getSessionToken } from './client';

export interface OTPRequestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface OTPVerifyResult {
  success: boolean;
  token?: string;
  familyUid?: string;
  email?: string;
  nickname?: string;
  avatar_url?: string;
  error?: string;
}

/**
 * OTP 인증코드 발송 요청
 * @param email 사용자 이메일
 */
export async function requestOTP(email: string): Promise<OTPRequestResult> {
  try {
    const { ok, data } = await hubFetch<OTPRequestResult>('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!ok) {
      return { success: false, error: data?.error || 'OTP 발송 실패' };
    }

    return { success: true, message: data?.message || 'OTP가 발송되었습니다.' };
  } catch (err) {
    console.error('[MerlinHub] requestOTP error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * OTP 인증코드 검증 → 성공 시 JWT를 localStorage에 저장
 * @param email 사용자 이메일
 * @param code 6자리 OTP 코드
 */
export async function verifyOTP(email: string, code: string): Promise<OTPVerifyResult> {
  try {
    const { ok, data } = await hubFetch<OTPVerifyResult>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });

    if (!ok) {
      return { success: false, error: data?.error || '인증 실패' };
    }

    // JWT 토큰 저장
    if (data.token) {
      setSessionToken(data.token);
    }

    // familyUid 저장 (지갑 등에서 참조)
    if (data.familyUid && typeof window !== 'undefined') {
      localStorage.setItem('merlin_family_uid', data.familyUid);
    }

    return {
      success: true,
      token: data.token,
      familyUid: data.familyUid,
      email: data.email || email,
      nickname: data.nickname,
      avatar_url: data.avatar_url,
    };
  } catch (err) {
    console.error('[MerlinHub] verifyOTP error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

export interface SessionResult {
  valid: boolean;
  email?: string;
  familyUid?: string;
  nickname?: string;
  avatar_url?: string;
}

/**
 * 현재 세션이 유효한지 확인
 */
export async function checkSession(): Promise<SessionResult> {
  const token = getSessionToken();
  if (!token) return { valid: false };

  try {
    const { ok, data } = await hubFetch<{ success: boolean; user: any }>('/api/auth/me');
    if (!ok || !data.success) {
      clearSessionToken();
      return { valid: false };
    }
    const u = data.user;
    return { 
      valid: true, 
      email: u.email, 
      familyUid: u.familyUid,
      nickname: u.nickname,
      avatar_url: u.avatar_url
    };
  } catch {
    return { valid: false };
  }
}

// ── 프로필 관리 (Hub SSOT) ──

export interface ProfileUpdateParams {
  nickname?: string;
  avatar_url?: string;
}

export interface ProfileResult {
  success: boolean;
  nickname?: string;
  avatar_url?: string;
  profile_image?: string; // 허브에서 profile_image로 반환할 경우 대비
  error?: string;
}

/**
 * Hub family_users에 프로필 정보 갱신
 * Endpoint: PUT /api/auth/profile
 */
export async function updateProfile(params: ProfileUpdateParams): Promise<ProfileResult> {
  try {
    const { ok, data } = await hubFetch<ProfileResult>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(params),
    });

    if (!ok) {
      return { success: false, error: data?.error || '프로필 업데이트 실패' };
    }

    return {
      success: true,
      nickname: data.nickname,
      avatar_url: data.avatar_url || data.profile_image,
    };
  } catch (err) {
    console.error('[MerlinHub] updateProfile error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * Hub에서 현재 유저 프로필 조회 (세션 토큰 기반)
 * 2026-04-23: /api/auth/me를 통해 최신 프로필까지 함께 가져옴
 */
export async function getProfile(): Promise<ProfileResult> {
  try {
    const session = await checkSession();
    if (!session.valid) {
      return { success: false, error: '세션이 유효하지 않습니다.' };
    }

    return {
      success: true,
      nickname: session.nickname,
      avatar_url: session.avatar_url
    };
  } catch (err) {
    console.error('[MerlinHub] getProfile error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 로그아웃 — 세션 토큰 삭제
 */
export function logout() {
  clearSessionToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('merlin_family_uid');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('userNickname');
    localStorage.removeItem('userProfileImage');
  }
}
