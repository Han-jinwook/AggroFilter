import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated REFACTORED_BY_MERLIN_HUB: 매직링크 인증 제거됨.
 * 인증은 허브 SDK (merlin-hub-sdk) → OTP 방식으로 전환.
 * 하위 호환용 리다이렉트 stub.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aggrofilter.com';
  return NextResponse.redirect(`${baseUrl}/?login_error=deprecated_magic_link`);
}
