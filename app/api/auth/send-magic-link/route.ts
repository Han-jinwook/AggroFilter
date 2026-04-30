import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family Hub 전환으로 매직링크 발송 제거됨.
 * 이메일 발송은 허브가 전담. 어그로필터에서 Resend 직접 호출 중단.
 */
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'deprecated — email auth moved to Merlin Hub',
  }, { status: 410 });
}
