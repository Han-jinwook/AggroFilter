/**
 * 사용자 식별 유틸리티 — Merlin Family Hub 통합
 * // REFACTORED_BY_MERLIN_HUB: t_users 의존 제거, Hub UID 기반으로 전환
 *
 * 신원(Identity) 저장소:
 *   - merlin_session_token: JWT (허브 발급)
 *   - merlin_user_id: UUID (허브 발급, 유일한 식별자)
 *   - userEmail: 이메일
 */

/** 비로그인 상태인지 확인 — Hub 세션 토큰 기준 */
export function isAnonymousUser(): boolean {
  if (typeof window === 'undefined') return true;
  return !localStorage.getItem('merlin_session_token');
}

/**
 * 로그인된 유저의 family_uid 반환 (비로그인 시 빈 문자열)
 * // REFACTORED_BY_MERLIN_HUB: 기존 t_users.f_id → Hub family_uid
 */
export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('merlin_user_id') || '';
}

/** 로그인된 유저의 이메일 반환 */
export function getUserEmail(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('userEmail') || '';
}

/** @deprecated 익명 세션 제거됨 — 하위 호환용 stub */
export function getOrCreateAnonId(): string {
  return '';
}

/** @deprecated 익명 세션 제거됨 */
export function getAnonAnimal(): { emoji: string; name: string } {
  return { emoji: '🐾', name: '게스트' };
}

/** @deprecated 익명 세션 제거됨 */
export function getAnonNickname(): string {
  return '게스트';
}

/** @deprecated 익명 세션 제거됨 */
export function getAnonEmoji(): string {
  return '🐾';
}
