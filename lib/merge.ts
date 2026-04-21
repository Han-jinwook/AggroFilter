/**
 * @deprecated Merlin Family OS 전환으로 익명 세션 병합 제거됨.
 * 하위 호환용 no-op stub — 모든 호출부가 안전하게 동작합니다.
 */
export async function mergeAnonToEmail(_userId: string, _email?: string): Promise<{ merged: boolean; error?: string }> {
  return { merged: false };
}
