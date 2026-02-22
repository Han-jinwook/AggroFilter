import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { commentId, type, userId: userIdFromBody } = body;

    let userId = userIdFromBody as string | undefined;
    if (!userId) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {
      }
    }

    if (!commentId || !type || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'like' && type !== 'dislike') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // 1. Ensure user exists (supports anon_id)
      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_id = $1', [userId]);
      if (userRes.rows.length === 0) {
        const isAnon = typeof userId === 'string' && userId.startsWith('anon_');
        const nickname = isAnon ? '익명사용자' : '사용자';
        await client.query(
          `INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [userId, isAnon ? userId : null, nickname, null]
        );
      }

      const existingRes = await client.query(
        'SELECT f_type FROM t_comment_interactions WHERE f_comment_id = $1 AND f_user_id = $2',
        [commentId, userId]
      );

      if (existingRes.rows.length > 0) {
        const existingType = existingRes.rows[0].f_type;
        if (existingType === type) {
          await client.query(
            'DELETE FROM t_comment_interactions WHERE f_comment_id = $1 AND f_user_id = $2',
            [commentId, userId]
          );
        } else {
          await client.query(
            'UPDATE t_comment_interactions SET f_type = $1 WHERE f_comment_id = $2 AND f_user_id = $3',
            [type, commentId, userId]
          );
        }
      } else {
        await client.query(
          'INSERT INTO t_comment_interactions (f_comment_id, f_user_id, f_type) VALUES ($1, $2, $3)',
          [commentId, userId, type]
        );
      }

      const countsRes = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE f_type = 'like') as like_count,
          COUNT(*) FILTER (WHERE f_type = 'dislike') as dislike_count
        FROM t_comment_interactions
        WHERE f_comment_id = $1
      `, [commentId]);

      const likeCount = parseInt(countsRes.rows[0].like_count) || 0;
      const dislikeCount = parseInt(countsRes.rows[0].dislike_count) || 0;

      return NextResponse.json({ 
        success: true, 
        likeCount, 
        dislikeCount 
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Comment Like Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
