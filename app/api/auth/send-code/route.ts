import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family Hub ?„í™˜?¼ë¡œ ?ì²´ OTP ë°œì†¡ ?œê±°??
 * ?¸ì¦?€ ?ˆë¸Œ SDK (merlin-hub-sdk) ??localhost:3001/api/auth/request-otp ?¼ë¡œ ?´ê?.
 * ?˜ìœ„ ?¸í™˜??no-op stub.
 */
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'deprecated ??use Merlin Hub auth',
    redirect: '/api/auth/request-otp via Hub SDK',
  }, { status: 410 });
}
