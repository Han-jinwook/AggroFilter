/**
 * 익명 세션 유틸리티
 * - anon_id 생성/조회
 * - 동물 이모지 + 별명 자동 매핑
 */

const ANIMALS = [
  { emoji: '🐶', name: '강아지' },
  { emoji: '🐱', name: '고양이' },
  { emoji: '🐻', name: '곰' },
  { emoji: '🐼', name: '판다' },
  { emoji: '🐨', name: '코알라' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🐯', name: '호랑이' },
  { emoji: '🐸', name: '개구리' },
  { emoji: '🐵', name: '원숭이' },
  { emoji: '🐰', name: '토끼' },
  { emoji: '🦁', name: '사자' },
  { emoji: '🐮', name: '소' },
  { emoji: '🐷', name: '돼지' },
  { emoji: '🐧', name: '펭귄' },
  { emoji: '🐔', name: '닭' },
  { emoji: '🦄', name: '유니콘' },
  { emoji: '🐝', name: '꿀벌' },
  { emoji: '🐢', name: '거북이' },
  { emoji: '🐙', name: '문어' },
  { emoji: '🐬', name: '돌고래' },
  { emoji: '🦋', name: '나비' },
  { emoji: '🐳', name: '고래' },
  { emoji: '🦉', name: '부엉이' },
  { emoji: '🐿️', name: '다람쥐' },
  { emoji: '🦈', name: '상어' },
  { emoji: '🐺', name: '늑대' },
  { emoji: '🦅', name: '독수리' },
  { emoji: '🐴', name: '말' },
  { emoji: '🦎', name: '도마뱀' },
  { emoji: '🐠', name: '물고기' },
] as const;

const ANON_ID_KEY = 'anonId';
const ANON_ANIMAL_INDEX_KEY = 'anonAnimalIndex';

function hashToIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % ANIMALS.length;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'anon-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = 'anon_' + generateUUID();
    localStorage.setItem(ANON_ID_KEY, id);
    const index = hashToIndex(id);
    localStorage.setItem(ANON_ANIMAL_INDEX_KEY, String(index));
  }
  return id;
}

export function getAnonAnimal(): { emoji: string; name: string } {
  if (typeof window === 'undefined') return { emoji: '🐾', name: '게스트' };
  const id = getOrCreateAnonId();
  const savedIndex = localStorage.getItem(ANON_ANIMAL_INDEX_KEY);
  const index = savedIndex !== null ? parseInt(savedIndex, 10) : hashToIndex(id);
  return ANIMALS[index] || ANIMALS[0];
}

export function getAnonNickname(): string {
  const animal = getAnonAnimal();
  return `익명${animal.name}`;
}

export function getAnonEmoji(): string {
  return getAnonAnimal().emoji;
}

export function isAnonymousUser(): boolean {
  if (typeof window === 'undefined') return true;
  const email = localStorage.getItem('userEmail');
  return !email || email.length === 0;
}

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  const email = localStorage.getItem('userEmail');
  if (email && email.length > 0) return email;
  return getOrCreateAnonId();
}
