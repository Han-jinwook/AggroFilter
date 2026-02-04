import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getCategoryName } from '@/lib/categoryMap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '1주일'

    let timeCondition = "a.f_created_at >= NOW() - INTERVAL '7 days'"

    if (period === '1일') {
      timeCondition = "a.f_last_action_at >= NOW() - INTERVAL '24 hours'"
    } else if (period === '1개월') {
      timeCondition = "a.f_created_at >= NOW() - INTERVAL '1 month'"
    }

    const client = await pool.connect()
    try {
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      const query = `
        SELECT
          COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') as id,
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as name,
          COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as "channelIcon",
          c.f_official_category_id as category_id,
          COUNT(a.f_id)::int as analysis_count,
          ROUND(AVG(a.f_reliability_score))::int as avg_reliability
        FROM t_channels c
        JOIN t_analyses a ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
        WHERE a.f_is_latest = TRUE
          AND ${timeCondition}
        GROUP BY
          COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id'),
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title'),
          COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url'),
          c.f_official_category_id
        ORDER BY analysis_count DESC, avg_reliability DESC
        LIMIT 20
      `

      let result = await client.query(query)

      if (period === '1일' && result.rows.length === 0) {
        const fallbackQuery = `
          SELECT
            COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') as id,
            COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as name,
            COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as "channelIcon",
            c.f_official_category_id as category_id,
            COUNT(a.f_id)::int as analysis_count,
            ROUND(AVG(a.f_reliability_score))::int as avg_reliability
          FROM t_channels c
          JOIN t_analyses a ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
          WHERE a.f_is_latest = TRUE
            AND a.f_created_at >= NOW() - INTERVAL '7 days'
          GROUP BY
            COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id'),
            COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title'),
            COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url'),
            c.f_official_category_id
          ORDER BY analysis_count DESC, avg_reliability DESC
          LIMIT 20
        `
        result = await client.query(fallbackQuery)
      }

      const channels = result.rows.map((row, index) => {
        const score = Number(row.avg_reliability) || 0

        return {
          id: row.id,
          rank: index + 1,
          name: row.name,
          channelIcon: row.channelIcon || '/placeholder.svg',
          topic: getCategoryName(row.category_id),
          count: Number(row.analysis_count) || 0,
          score,
          color: score >= 70 ? 'green' : 'red',
        }
      })

      return NextResponse.json({ channels })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Plaza Channels API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}
