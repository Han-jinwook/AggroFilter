import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { getCategoryName } from '@/lib/categoryMap';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email: emailFromBody } = await request.json();

    let email = emailFromBody as string | undefined;
    if (!email) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) email = data.user.email;
      } catch {
      }
    }

    if (!email) {
      return NextResponse.json({ videos: [] });
    }

    const client = await pool.connect();

    try {
      // Query user's analyses directly from DB using email
      // No localStorage dependency - pure DB-based approach
      
      // [v2.2 Optimization] Use f_is_latest = true instead of CTE
      const refinedQuery = `
      SELECT 
        a.f_id as id,
        a.f_title as title,
        a.f_reliability_score as score,
        a.f_created_at as created_at,
        COALESCE(NULLIF(c.f_title, ''), '알 수 없음') as channel_name,
        COALESCE(NULLIF(c.f_thumbnail_url, ''), '/placeholder.svg') as channel_icon,
        a.f_official_category_id as category_id,
        a.f_channel_id as channel_id
      FROM t_analyses a
      LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
      WHERE a.f_user_id = $1
        AND a.f_is_latest = TRUE
      ORDER BY a.f_created_at DESC
    `;

    const res = await client.query(refinedQuery, [email]);
      
      const videos = res.rows.map(row => ({
        id: row.id,
        title: row.title,
        channel: row.channel_name || '알 수 없음',
        channelIcon: row.channel_icon,
        score: row.score,
        category: getCategoryName(row.category_id),
        fullDate: row.created_at, // 정렬용 정밀 타임스탬프 추가
        date: new Date(row.created_at).toLocaleDateString('ko-KR', {
           year: '2-digit',
           month: '2-digit',
           day: '2-digit'
        }).replace(/\./g, '').split(' ').join('.'), // Format: 25.01.15
        rank: '-', 
        totalRank: '-', 
        views: '-' // Not available in t_analyses
      }));

      return NextResponse.json({ videos });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching mypage videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
