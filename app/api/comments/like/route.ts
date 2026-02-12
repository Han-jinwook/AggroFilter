import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { commentId, type, email: emailFromBody } = body;

    let email = emailFromBody as string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) email = data.user.email;
    } catch {
    }

    if (!commentId || !type || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'like' && type !== 'dislike') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const userId = userRes.rows[0].f_id;

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
