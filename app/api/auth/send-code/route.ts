import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family Hub 전환으로 자체 OTP 발송 제거됨.
 * 인증은 허브 SDK (merlin-hub-sdk) → localhost:3001/api/auth/request-otp 으로 이관.
 * 하위 호환용 no-op stub.
 */
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'deprecated — use Merlin Hub auth',
    redirect: '/api/auth/request-otp via Hub SDK',
  }, { status: 410 });
}
