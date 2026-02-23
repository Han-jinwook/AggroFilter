import { NextResponse } from 'next/server'
import { getCafe24AccessToken, getCafe24ApiBaseUrl, getCafe24MallId } from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminSecret = searchParams.get('secret')
    const webhookSecret = process.env.CAFE24_WEBHOOK_SECRET

    if (!adminSecret || adminSecret !== webhookSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const mallId = getCafe24MallId()
    const base = getCafe24ApiBaseUrl().replace(/\/$/, '')
    const token = await getCafe24AccessToken()

    const baseUrl = (process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://aggrofilter.com').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/cafe24/webhook?secret=${webhookSecret}`

    const res = await fetch(`${base}/admin/webhooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2025-12-01',
      },
      body: JSON.stringify({
        shop_no: 1,
        event_type: 'order_complete',
        endpoint_url: webhookUrl,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: 'webhook registration failed', status: res.status, data }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mallId, data })
  } catch (e: any) {
    console.error('Webhook register error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
