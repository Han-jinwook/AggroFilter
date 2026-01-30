import { pool } from '@/lib/db'

type TCafe24TokenRow = {
  f_mall_id: string
  f_access_token: string
  f_refresh_token: string | null
  f_expires_at: string | null
  f_updated_at: string | null
}

function getRequiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is required`)
  return v
}

export function getCafe24MallId(): string {
  return getRequiredEnv('CAFE24_MALL_ID')
}

export function getCafe24ApiBaseUrl(): string {
  const explicit = process.env.CAFE24_API_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const mallId = getCafe24MallId()
  return `https://${mallId}.cafe24api.com/api/v2`
}

export function getCafe24WebhookSecret(): string {
  return getRequiredEnv('CAFE24_WEBHOOK_SECRET')
}

export function getCafe24CreditProductMap(): Record<string, number> {
  const raw = process.env.CAFE24_CREDIT_PRODUCT_MAP
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(obj)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n > 0) out[String(k)] = n
    }
    return out
  } catch {
    return {}
  }
}

export async function ensureCafe24Tables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS t_cafe24_tokens (
      f_mall_id TEXT PRIMARY KEY,
      f_access_token TEXT NOT NULL,
      f_refresh_token TEXT,
      f_expires_at TIMESTAMP,
      f_updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS t_cafe24_webhook_events (
      f_id TEXT PRIMARY KEY,
      f_event_type TEXT,
      f_order_id TEXT,
      f_created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`)
}

export async function saveCafe24Tokens(params: {
  mallId: string
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number | null
}) {
  const client = await pool.connect()
  try {
    await ensureCafe24Tables(client)

    const expiresAt =
      typeof params.expiresInSeconds === 'number' && Number.isFinite(params.expiresInSeconds)
        ? new Date(Date.now() + params.expiresInSeconds * 1000)
        : null

    await client.query(
      `INSERT INTO t_cafe24_tokens (f_mall_id, f_access_token, f_refresh_token, f_expires_at, f_updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (f_mall_id) DO UPDATE SET
         f_access_token = EXCLUDED.f_access_token,
         f_refresh_token = EXCLUDED.f_refresh_token,
         f_expires_at = EXCLUDED.f_expires_at,
         f_updated_at = NOW()`,
      [params.mallId, params.accessToken, params.refreshToken, expiresAt]
    )
  } finally {
    client.release()
  }
}

export async function loadCafe24Tokens(mallId: string): Promise<TCafe24TokenRow | null> {
  const client = await pool.connect()
  try {
    await ensureCafe24Tables(client)
    const res = await client.query(
      `SELECT f_mall_id, f_access_token, f_refresh_token, f_expires_at, f_updated_at
       FROM t_cafe24_tokens
       WHERE f_mall_id = $1
       LIMIT 1`,
      [mallId]
    )
    if (res.rows.length === 0) return null
    return res.rows[0] as TCafe24TokenRow
  } finally {
    client.release()
  }
}

async function refreshCafe24AccessToken(params: {
  mallId: string
  refreshToken: string
}): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number | null }> {
  const base = getCafe24ApiBaseUrl().replace(/\/$/, '')
  const clientId = getRequiredEnv('CAFE24_CLIENT_ID').trim()
  const clientSecret = getRequiredEnv('CAFE24_CLIENT_SECRET').trim()
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')

  // Rollback to Basic Auth Header
  const res = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cafe24 token refresh failed: ${res.status} ${text}`)
  }

  const data: any = await res.json()
  return {
    accessToken: String(data.access_token || ''),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : data.expires_in ? Number(data.expires_in) : null,
  }
}

export async function getCafe24AccessToken(): Promise<string> {
  const mallId = getCafe24MallId()
  const row = await loadCafe24Tokens(mallId)
  if (!row) throw new Error('Cafe24 tokens not configured')

  const expiresAt = row.f_expires_at ? new Date(row.f_expires_at).getTime() : null
  const now = Date.now()
  if (expiresAt && expiresAt - now > 60_000) return row.f_access_token

  if (!row.f_refresh_token) return row.f_access_token

  const refreshed = await refreshCafe24AccessToken({ mallId, refreshToken: row.f_refresh_token })
  await saveCafe24Tokens({
    mallId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresInSeconds: refreshed.expiresIn,
  })
  return refreshed.accessToken
}

export async function fetchCafe24Order(orderId: string): Promise<any> {
  const base = getCafe24ApiBaseUrl().replace(/\/$/, '')
  const token = await getCafe24AccessToken()

  const res = await fetch(`${base}/admin/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cafe24 order fetch failed: ${res.status} ${text}`)
  }

  return res.json()
}

export function extractUserEmailFromOrder(orderData: any): string | null {
  const candidates: string[] = []

  const pushStr = (v: any) => {
    if (typeof v === 'string' && v.trim().length > 0) candidates.push(v)
  }

  pushStr(orderData?.order?.buyer_email)
  pushStr(orderData?.order?.email)
  pushStr(orderData?.order?.buyer?.email)
  pushStr(orderData?.order?.receiver?.email)
  pushStr(orderData?.order?.shipping_message)
  pushStr(orderData?.order?.memo)
  pushStr(orderData?.order?.additional_information)

  const joined = candidates.join(' ')
  const match = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0] : null
}

export function calculateCreditsFromOrder(orderData: any): number {
  const productMap = getCafe24CreditProductMap()

  const items: any[] =
    Array.isArray(orderData?.order_items) ? orderData.order_items : Array.isArray(orderData?.items) ? orderData.items : []

  let total = 0
  for (const it of items) {
    const productNo = it?.product_no != null ? String(it.product_no) : null
    const qty = it?.quantity != null ? Number(it.quantity) : 1
    if (productNo && productMap[productNo]) {
      const add = productMap[productNo] * (Number.isFinite(qty) && qty > 0 ? qty : 1)
      total += add
    }
  }

  return total
}

export async function markWebhookEventOnce(params: { id: string; eventType: string | null; orderId: string | null }): Promise<boolean> {
  const client = await pool.connect()
  try {
    await ensureCafe24Tables(client)

    const res = await client.query(
      `INSERT INTO t_cafe24_webhook_events (f_id, f_event_type, f_order_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (f_id) DO NOTHING`,
      [params.id, params.eventType, params.orderId]
    )

    return res.rowCount === 1
  } finally {
    client.release()
  }
}

export async function addCreditsByEmail(params: { email: string; amount: number }) {
  const client = await pool.connect()
  try {
    await ensureCafe24Tables(client)
    await client.query(
      `UPDATE t_users
       SET f_recheck_credits = COALESCE(f_recheck_credits, 0) + $1,
           f_updated_at = NOW()
       WHERE f_email = $2`,
      [params.amount, params.email]
    )
  } finally {
    client.release()
  }
}
