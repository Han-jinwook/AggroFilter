import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getCategoryName } from '@/lib/categoryMap'
import { getCached, setCache } from '@/lib/plaza-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'korean'

    const cacheKey = `channels:${lang}`
    const cached = getCached<{ channels: any[] }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const client = await pool.connect()
    try {
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      const query = `
        SELECT
          c.f_channel_id as id,
          c.f_title as name,
          c.f_thumbnail_url as "channelIcon",
          c.f_official_category_id as category_id,
          COUNT(a.f_id)::int as analysis_count,
          ROUND(AVG(a.f_reliability_score))::int as avg_reliability,
          ROUND(AVG(a.f_clickbait_score))::int as avg_clickbait
        FROM t_channels c
        JOIN t_analyses a ON a.f_channel_id = c.f_channel_id
        WHERE a.f_is_latest = TRUE
          AND COALESCE(c.f_language, 'korean') = $1
        GROUP BY c.f_channel_id, c.f_title, c.f_thumbnail_url, c.f_official_category_id
        ORDER BY analysis_count DESC, avg_reliability DESC
        LIMIT 100
      `

      const result = await client.query(query, [lang])

      const channels = result.rows.map((row, index) => {
        const score = Number(row.avg_reliability) || 0

        return {
          id: row.id,
          rank: index + 1,
          name: row.name,
          channelIcon: row.channelIcon || '/placeholder.svg',
          topic: getCategoryName(Number(row.category_id)),
          count: Number(row.analysis_count) || 0,
          avgClickbait: Number(row.avg_clickbait) || 0,
          score,
          color: score >= 70 ? 'green' : 'red',
        }
      })

      const responseData = { channels }
      setCache(cacheKey, responseData)
      return NextResponse.json(responseData)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Plaza Channels API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}
