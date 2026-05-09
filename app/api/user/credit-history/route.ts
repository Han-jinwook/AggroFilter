import { NextResponse } from 'next/server';
import { getHistory } from '@/src/services/merlin-hub-sdk/wallet';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

/**
 * [REFACTORED] Hub 중앙 지갑 기반 이용 내역 조회
 */
export async function GET(request: Request) {
  try {
    let userId: string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
    } catch {}

    if (!userId) {
      const { searchParams } = new URL(request.url);
      const fallback = searchParams.get('userId');
      if (fallback && typeof fallback === 'string' && fallback.length > 0) {
        userId = fallback;
      }
    }

    if (!userId) {
      return NextResponse.json({ history: [], loggedIn: false });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    // Hub SDK를 통한 이용 내역 조회
    const res = await getHistory(userId, page);

    if (!res.success) {
      return NextResponse.json({ history: [], loggedIn: true, error: res.error });
    }

    return NextResponse.json({
      history: (res.history || []).map(r => ({
        id: r.id,
        type: r.transaction_type,
        amount: r.amount,
        // Hub API가 balance를 각 레코드마다 제공하지 않으면 여기서 계산하거나 생략 (프론트엔드 호환성 유지)
        balance: r.balance || 0, 
        description: r.display_text,
        createdAt: r.created_at,
      })),
      total: res.total || 0,
      page: res.page || page,
      totalPages: res.totalPages || 1,
      loggedIn: true,
    });
  } catch (error) {
    console.error('Credit history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
