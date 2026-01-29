import { NextResponse } from 'next/server'
import { getCafe24MallId } from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const redirectAfter = searchParams.get('redirect')
  const redirect = redirectAfter && redirectAfter.startsWith('/') ? redirectAfter : '/'
  const debug = searchParams.get('debug')

  const mallId = getCafe24MallId()
  const clientId = process.env.CAFE24_CLIENT_ID
  const redirectUri = process.env.CAFE24_REDIRECT_URI
  const scope = process.env.CAFE24_OAUTH_SCOPE

  if (!clientId || !redirectUri || !scope) {
    return NextResponse.json(
      { error: 'CAFE24_CLIENT_ID, CAFE24_REDIRECT_URI, CAFE24_OAUTH_SCOPE are required' },
      { status: 500 }
    )
  }

  const state = Buffer.from(JSON.stringify({ redirect, t: Date.now() })).toString('base64url')

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
