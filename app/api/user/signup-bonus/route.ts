import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated REFACTORED_BY_MERLIN_HUB: 가입 보너스는 Hub가 자동 지급 (3,000C).
 * 앱에서 별도 보너스 지급 로직 제거. 하위 호환용 stub.
 */
export async function POST() {
  return NextResponse.json({
    bonus: 0,
    alreadyGiven: true,
    balance: 0,
    message: 'deprecated — signup bonus handled by Merlin Hub',
  });
}
