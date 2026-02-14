import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const focusChannelId = searchParams.get('channelId');

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 10000) : 1000;
  const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

  try {
    const client = await pool.connect();
    try {
      const whereClause = categoryId && categoryId !== 'all' ? `WHERE cs.f_official_category_id = $1` : ``;
      const whereValues: any[] = [];
      if (whereClause) {
        whereValues.push(Number.parseInt(categoryId as string, 10));
      }

      const countRes = await client.query(
        `SELECT COUNT(*)::int AS total_count FROM t_channel_stats cs ${whereClause}`,
        whereValues,
      );
      const totalCount = countRes.rows?.[0]?.total_count ?? 0;

      const pageSql = `
        SELECT 
          cs.f_channel_id as id,
          cs.f_official_category_id as category_id,
          cs.f_avg_reliability as score,
          c.f_title as name,
          c.f_thumbnail_url as avatar,
          (
            SELECT COUNT(*)::int FROM t_analyses a
            WHERE a.f_channel_id = cs.f_channel_id
              AND a.f_is_latest = TRUE
              AND a.f_official_category_id = cs.f_official_category_id
          ) as analysis_count
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        ${whereClause}
        ORDER BY cs.f_avg_reliability DESC, cs.f_channel_id ASC
        LIMIT $${whereValues.length + 1}
        OFFSET $${whereValues.length + 2}
      `;

      const pageValues = [...whereValues, safeLimit, safeOffset];
      const res = await client.query(pageSql, pageValues);

      const rankedChannels = res.rows.map((row, index) => ({
        id: row.id,
        rank: safeOffset + index + 1,
        name: row.name,
        avatar: row.avatar,
        score: Number.parseFloat(row.score),
        categoryId: row.category_id,
        analysisCount: row.analysis_count || 0,
      }));

      const nextOffset = safeOffset + rankedChannels.length < totalCount ? safeOffset + rankedChannels.length : null;

      let focusRank: any = null;

      if (focusChannelId) {
        try {
          const frValues: any[] = [];
          let frWhere = '';
          if (categoryId && categoryId !== 'all') {
            frWhere = 'WHERE cs.f_official_category_id = $1';
            frValues.push(Number.parseInt(categoryId, 10));
          }
          frValues.push(focusChannelId);
          const chParamIdx = frValues.length;

          const frSql = `
            WITH Ranked AS (
              SELECT cs.f_channel_id, cs.f_official_category_id, cs.f_avg_reliability,
                ROW_NUMBER() OVER (ORDER BY cs.f_avg_reliability DESC, cs.f_channel_id ASC) AS rank,
                COUNT(*) OVER () AS total_count
              FROM t_channel_stats cs
              ${frWhere}
            )
            SELECT r.f_channel_id AS id, r.f_official_category_id AS category_id,
              r.f_avg_reliability AS score, r.rank, r.total_count,
              c.f_title AS name, c.f_thumbnail_url AS avatar
            FROM Ranked r
            JOIN t_channels c ON c.f_channel_id = r.f_channel_id
            WHERE r.f_channel_id = $${chParamIdx}
            LIMIT 1
          `;

          const frRes = await client.query(frSql, frValues);
          if (frRes.rows.length > 0) {
            const row = frRes.rows[0];
            const topPercentile = row.total_count > 0 ? Math.round((Number(row.rank) / Number(row.total_count)) * 100) : null;
            focusRank = {
              id: row.id,
              rank: Number(row.rank),
              name: row.name,
              avatar: row.avatar,
              score: Number.parseFloat(row.score),
              categoryId: row.category_id,
              totalCount: Number(row.total_count),
              topPercentile,
            };
          }
        } catch (e) {
          console.error('[Ranking API] focusRank query failed:', e);
        }
      }

      return NextResponse.json({
        channels: rankedChannels,
        totalCount,
        nextOffset,
        focusRank,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ranking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
