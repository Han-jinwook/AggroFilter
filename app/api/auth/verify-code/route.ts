import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family Hub ?„í™˜?¼ë¡œ ?ì²´ OTP ê²€ì¦??œê±°??
 * ?¸ì¦?€ ?ˆë¸Œ SDK (merlin-hub-sdk) ??localhost:3001/api/auth/verify-otp ?¼ë¡œ ?´ê?.
 * ?˜ìœ„ ?¸í™˜??no-op stub.
 */
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'deprecated ??use Merlin Hub auth',
    redirect: '/api/auth/verify-otp via Hub SDK',
  }, { status: 410 });
}
