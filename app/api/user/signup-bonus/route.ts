import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated REFACTORED_BY_MERLIN_HUB: 가??보너?�는 Hub가 ?�동 지�?(3,000C).
 * ?�에??별도 보너??지�?로직 ?�거. ?�위 ?�환??stub.
 */
export async function POST() {
  return NextResponse.json({
    bonus: 0,
    alreadyGiven: true,
    balance: 0,
    message: 'deprecated ??signup bonus handled by Merlin Hub',
  });
}
