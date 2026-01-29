import { NextResponse } from 'next/server'
import { getCafe24MallId, loadCafe24Tokens } from '@/lib/cafe24'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const mallId = getCafe24MallId()
    const row = await loadCafe24Tokens(mallId)

    return NextResponse.json({
      mallId,
      configured: Boolean(row?.f_access_token),
      expiresAt: row?.f_expires_at ?? null,
      updatedAt: row?.f_updated_at ?? null,
    })
  } catch (e) {
    console.error('Cafe24 oauth status error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
