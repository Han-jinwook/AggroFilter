import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated REFACTORED_BY_MERLIN_HUB: ë§¤ì§ë§í¬ ?¸ì¦ ?œê±°??
 * ?¸ì¦?€ ?ˆë¸Œ SDK (merlin-hub-sdk) ??OTP ë°©ì‹?¼ë¡œ ?„í™˜.
 * ?˜ìœ„ ?¸í™˜??ë¦¬ë‹¤?´ë ‰??stub.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aggrofilter.com';
  return NextResponse.redirect(`${baseUrl}/?login_error=deprecated_magic_link`);
}
