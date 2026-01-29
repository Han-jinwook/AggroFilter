import { NextResponse } from 'next/server'
import { getCafe24ApiBaseUrl, getCafe24MallId, saveCafe24Tokens } from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')
    const oauthErrorDescription = searchParams.get('error_description')
    const oauthErrorUri = searchParams.get('error_uri')

    if (oauthError) {
      const mallId = getCafe24MallId()
      const redirectUri = process.env.CAFE24_REDIRECT_URI
      const scope = process.env.CAFE24_OAUTH_SCOPE

      return NextResponse.json(
        {
          error: oauthError,
          error_description: oauthErrorDescription,
          error_uri: oauthErrorUri,
          mallId,
          redirectUri,
          scope,
          hint:
            'Check Cafe24 Developer Center OAuth Redirect URI exactly matches redirectUri above (https, path, trailing slash). Also ensure app is installed for this mallId.',
        },
        { status: 400 }
      )
    }

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const mallId = getCafe24MallId()
    const clientId = process.env.CAFE24_CLIENT_ID
    const clientSecret = process.env.CAFE24_CLIENT_SECRET
    const redirectUri = process.env.CAFE24_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_REDIRECT_URI are required' },
        { status: 500 }
      )
    }

    const base = getCafe24ApiBaseUrl().replace(/\/$/, '')
    const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
    const res = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `token exchange failed: ${res.status} ${text}` }, { status: 500 })
    }

    const data: any = await res.json()
    const accessToken = String(data.access_token || '')
    if (!accessToken) {
      return NextResponse.json({ error: 'no access_token in response' }, { status: 500 })
    }

    await saveCafe24Tokens({
      mallId,
      accessToken,
      refreshToken: data.refresh_token ? String(data.refresh_token) : null,
      expiresInSeconds: typeof data.expires_in === 'number' ? data.expires_in : data.expires_in ? Number(data.expires_in) : null,
    })

    let redirect = '/'
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
        if (parsed?.redirect && typeof parsed.redirect === 'string' && parsed.redirect.startsWith('/')) redirect = parsed.redirect
      } catch {
        redirect = '/'
      }
    }

    return NextResponse.redirect(new URL(redirect, request.url))
  } catch (e) {
    console.error('Cafe24 oauth callback error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
