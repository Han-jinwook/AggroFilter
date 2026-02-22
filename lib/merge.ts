/**
 * 익명 세션 → 이메일 계정 데이터 병합 유틸리티
 * 로그인 성공 시 호출하여 anon_id 데이터를 email 계정으로 이전합니다.
 */

const ANON_ID_KEY = 'anonId';

export async function mergeAnonToEmail(userId: string, email?: string): Promise<{ merged: boolean; error?: string }> {
  try {
    const anonId = localStorage.getItem(ANON_ID_KEY);
    if (!anonId || !anonId.startsWith('anon_')) {
      return { merged: false };
    }

    const res = await fetch('/api/user/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, userId, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[merge] API error:', data.error);
      return { merged: false, error: data.error };
    }

    if (data.merged) {
      localStorage.removeItem(ANON_ID_KEY);
      localStorage.removeItem('anonAnimalIndex');
      console.log(`[merge] Successfully merged ${anonId} → userId: ${userId}`);
    }

    return { merged: data.merged };
  } catch (err) {
    console.error('[merge] Failed:', err);
    return { merged: false, error: 'Network error' };
  }
}
