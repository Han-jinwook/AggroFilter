import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family Hub 전환으로 이메일 알림 발송 제거됨.
 * 모든 이메일 발송(OTP, 알림 다이제스트)은 허브가 전담.
 * 하위 호환용 no-op stub.
 */
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'deprecated — email notifications moved to Merlin Hub',
  }, { status: 410 });
}
