import { NextResponse } from 'next/server'
import { getCafe24MallId } from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const redirectAfter = searchParams.get('redirect')
  const redirect = redirectAfter && redirectAfter.startsWith('/') ? redirectAfter : '/'
  const debug = searchParams.get('debug')

  // 심사팀 테스트 몰 대응: 쿼리 파라미터 mall_id를 우선 사용
  const mallIdFromParam = searchParams.get('mall_id')?.trim()
  const mallId = mallIdFromParam || getCafe24MallId()
  const clientId = process.env.CAFE24_CLIENT_ID
  const redirectUri = process.env.CAFE24_REDIRECT_URI
  const scope = process.env.CAFE24_OAUTH_SCOPE

  if (!clientId || !redirectUri || !scope) {
    return NextResponse.json(
      { error: 'CAFE24_CLIENT_ID, CAFE24_REDIRECT_URI, CAFE24_OAUTH_SCOPE are required' },
      { status: 500 }
    )
  }

  // callback 토큰 교환 시 auth code 발급에 사용된 동일 mall_id를 쓰도록 state에 포함
  const state = Buffer.from(JSON.stringify({ redirect, mall_id: mallId, t: Date.now() })).toString('base64url')

  const authUrl = new URL(`https://${mallId}.cafe24api.com/api/v2/oauth/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)

  if (debug === '1') {
    return NextResponse.json({ mallId, redirectUri, scope, authUrl: authUrl.toString() })
  }

  return NextResponse.redirect(authUrl)
}
