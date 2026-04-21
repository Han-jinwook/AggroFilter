/**
 * 사용자 식별 유틸리티 (경량화)
 * - Merlin Family OS 전환 준비: 익명 세션 관리 제거
 * - 비로그인 시 1회 휘발성 체험만 허용 (DB 미저장)
 */

/** 비로그인 상태인지 확인 */
export function isAnonymousUser(): boolean {
  if (typeof window === 'undefined') return true;
  const email = localStorage.getItem('userEmail');
  return !email || email.length === 0;
}

/** 로그인된 유저의 ID 반환 (비로그인 시 빈 문자열) */
export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('userId') || '';
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
