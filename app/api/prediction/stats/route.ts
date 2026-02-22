import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const res = await client.query(
        `SELECT total_predictions, avg_gap, current_tier, current_tier_label, tier_emoji
         FROM t_users WHERE f_id = $1`,
        [id]
      )

      if (res.rows.length === 0) {
        return NextResponse.json({
          totalPredictions: 0,
          avgGap: 0,
          currentTier: null,
          currentTierLabel: null,
          tierEmoji: null,
        })
      }

      const u = res.rows[0]
      return NextResponse.json({
        totalPredictions: Number(u.total_predictions) || 0,
        avgGap: u.avg_gap !== null ? Number(u.avg_gap) : 0,
        currentTier: u.current_tier || null,
        currentTierLabel: u.current_tier_label || null,
        tierEmoji: u.tier_emoji || null,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Prediction stats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
