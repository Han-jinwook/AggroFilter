import { NextResponse } from 'next/server'

// REFACTORED_BY_MERLIN_HUB: t_users ê²°ì œ ì½œë°± ??Hub wallet ?´ê? ?ˆì •
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const amountParam = searchParams.get('amount')
    const userId = searchParams.get('userId')
    const redirectUrlParam = searchParams.get('redirectUrl')

    const redirectUrl = redirectUrlParam && redirectUrlParam.startsWith('/') ? redirectUrlParam : '/'

    if (status !== 'success' || !userId) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const amount = Number(amountParam)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    console.log('[Payment Callback] Legacy callback hit. Credit mutation is disabled.', {
      userId,
      amount,
      status,
    })

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
