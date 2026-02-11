import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoId, text, email: emailFromBody, nickname, parentId } = body;

    let email = emailFromBody as string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) email = data.user.email;
    } catch {
    }

    if (!videoId || !text || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Check or Create User
      let userId;
      const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
      
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].f_id;
        // Update nickname if changed (optional)
        if (nickname) {
            await client.query('UPDATE t_users SET f_nickname = $1 WHERE f_id = $2', [nickname, userId]);
        }
      } else {
        userId = uuidv4(); // Or use email as ID if preferred, but UUID is safer
        // Create new user
        // Assuming f_image is optional
        await client.query(`
          INSERT INTO t_users (f_id, f_email, f_nickname, f_created_at, f_updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
        `, [userId, email, nickname || email.split('@')[0]]);
      }

      // 2. Insert Comment
      const commentId = uuidv4();
      await client.query(`
        INSERT INTO t_comments (f_id, f_text, f_video_id, f_user_id, f_parent_id, f_created_at, f_updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [commentId, text, videoId, userId, parentId || null]);

      await client.query('COMMIT');

      // Return the new comment data so frontend can prepend it immediately
      const newComment = {
        id: commentId,
        text,
        videoId,
        userId,
        parentId,
        author: nickname || email.split('@')[0],
        date: new Date().toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1),
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
        replies: []
      };

      return NextResponse.json({ success: true, comment: newComment });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Comment Creation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
