import { NextResponse } from 'next/server';
import { getBalance } from '@/src/services/merlin-hub-sdk';

export const runtime = 'nodejs';

/**
 * [REFACTORED] Hub 중앙 지갑 기반 잔액 조회
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false });
    }

    // Hub SDK를 통한 잔액 조회
    const res = await getBalance(userId);

    if (!res.success) {
      return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: true, error: res.error });
    }

    return NextResponse.json({
      credits: res.balance || 0,
      adFreeUntil: null,
      loggedIn: true,
    });
  } catch (error) {
    console.error('GET /api/user/credits error:', error);
    return NextResponse.json({ credits: 0, adFreeUntil: null, loggedIn: false }, { status: 500 });
  }
}
