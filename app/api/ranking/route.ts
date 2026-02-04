import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const email = searchParams.get('email');
  const focusChannelId = searchParams.get('channelId');

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
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
        `
          SELECT COUNT(*)::int AS total_count
          FROM t_channel_stats cs
          ${whereClause}
        `,
        whereValues,
      );
      const totalCount = countRes.rows?.[0]?.total_count ?? 0;

      const pageSql = `
        SELECT 
          cs.f_channel_id as id,
          cs.f_official_category_id as category_id,
          cs.f_avg_reliability as score,
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as name,
          COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as avatar
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
        ${whereClause}
        ORDER BY cs.f_avg_reliability DESC
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
      }));

      const nextOffset = safeOffset + rankedChannels.length < totalCount ? safeOffset + rankedChannels.length : null;

      let myRank: any = null;

      if (focusChannelId) {
        try {
          const myRankValues: any[] = [];
          let myRankWhere = '';
          if (categoryId && categoryId !== 'all') {
            myRankWhere = 'WHERE cs.f_official_category_id = $1';
            myRankValues.push(Number.parseInt(categoryId, 10));
          }
          myRankValues.push(focusChannelId);
          const channelIdParamIndex = myRankValues.length;

          const myRankSql = `
            WITH Ranked AS (
              SELECT
                cs.f_channel_id,
                cs.f_official_category_id,
                cs.f_avg_reliability,
                ROW_NUMBER() OVER (ORDER BY cs.f_avg_reliability DESC) AS rank,
                COUNT(*) OVER () AS total_count
              FROM t_channel_stats cs
              ${myRankWhere}
            )
            SELECT
              r.f_channel_id AS id,
              r.f_official_category_id AS category_id,
              r.f_avg_reliability AS score,
              r.rank,
              r.total_count,
              COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') AS name,
              COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') AS avatar
            FROM Ranked r
            JOIN t_channels c ON COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') = r.f_channel_id
            WHERE r.f_channel_id = $${channelIdParamIndex}
            LIMIT 1
          `;

          const myRankRes = await client.query(myRankSql, myRankValues);
          if (myRankRes.rows.length > 0) {
            const row = myRankRes.rows[0];
            const topPercentile = row.total_count > 0 ? Math.round((row.rank / row.total_count) * 100) : null;
            myRank = {
              id: row.id,
              rank: row.rank,
              name: row.name,
              avatar: row.avatar,
              score: Number.parseFloat(row.score),
              categoryId: row.category_id,
              totalCount: row.total_count,
              topPercentile,
            };
          }
        } catch (e) {
          console.error('[Ranking API] myRank (channelId) query failed:', e);
          myRank = null;
        }
      }

      if (!myRank && email) {
        try {
          const tableExistsRes = await client.query(
            `SELECT to_regclass('public.t_channel_subscriptions') IS NOT NULL AS exists`,
          );
          const tableExists = tableExistsRes.rows?.[0]?.exists === true;
          if (tableExists) {
            const myRankValues: any[] = [];
            let myRankWhere = '';
            if (categoryId && categoryId !== 'all') {
              myRankWhere = 'WHERE cs.f_official_category_id = $1';
              myRankValues.push(Number.parseInt(categoryId, 10));
            }

            myRankValues.push(email);
            const emailParamIndex = myRankValues.length;

            const myRankSql = `
              WITH Ranked AS (
                SELECT
                  cs.f_channel_id,
                  cs.f_official_category_id,
                  cs.f_avg_reliability,
                  ROW_NUMBER() OVER (ORDER BY cs.f_avg_reliability DESC) AS rank,
                  COUNT(*) OVER () AS total_count
                FROM t_channel_stats cs
                ${myRankWhere}
              )
              SELECT
                r.f_channel_id AS id,
                r.f_official_category_id AS category_id,
                r.f_avg_reliability AS score,
                r.rank,
                r.total_count,
                COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') AS name,
                COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') AS avatar
              FROM Ranked r
              JOIN t_channel_subscriptions s ON s.f_channel_id = r.f_channel_id
              JOIN t_channels c ON COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id') = r.f_channel_id
              WHERE s.f_user_id = $${emailParamIndex}
              ORDER BY r.rank ASC
              LIMIT 1
            `;

            const myRankRes = await client.query(myRankSql, myRankValues);
            if (myRankRes.rows.length > 0) {
              const row = myRankRes.rows[0];
              const topPercentile = row.total_count > 0 ? Math.round((row.rank / row.total_count) * 100) : null;
              myRank = {
                id: row.id,
                rank: row.rank,
                name: row.name,
                avatar: row.avatar,
                score: Number.parseFloat(row.score),
                categoryId: row.category_id,
                totalCount: row.total_count,
                topPercentile,
              };
            }
          }
        } catch (e) {
          console.error('[Ranking API] myRank query failed:', e);
          myRank = null;
        }
      }

      return NextResponse.json({
        channels: rankedChannels,
        totalCount,
        nextOffset,
        myRank,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ranking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
