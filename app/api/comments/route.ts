import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { analysisId, text, userId: userIdFromBody, nickname, parentId, profileImage } = body;

    let userId = userIdFromBody as string | undefined;
    if (!userId) {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      } catch {
      }
    }

    if (!analysisId || !text || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Check or Create User
      const userRes = await client.query('SELECT f_id, f_email FROM t_users WHERE f_id = $1', [userId]);
      
      if (userRes.rows.length > 0) {
        // Update nickname and image if provided
        if (nickname || profileImage) {
            const updates: string[] = [];
            const vals: any[] = [];
            let idx = 1;
            if (nickname) { updates.push(`f_nickname = $${idx++}`); vals.push(nickname); }
            if (profileImage) { updates.push(`f_image = $${idx++}`); vals.push(profileImage); }
            vals.push(userId);
            await client.query(`UPDATE t_users SET ${updates.join(', ')} WHERE f_id = $${idx}`, vals);
        }
      } else {
        const isAnon = typeof userId === 'string' && userId.startsWith('anon_');
        const defaultNickname = isAnon ? (nickname || '익명사용자') : (nickname || '사용자');
        await client.query(`
          INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [userId, null, defaultNickname, profileImage || null]);
      }

      // 2. Insert Comment
      const insertRes = await client.query(`
        INSERT INTO t_comments (f_text, f_analysis_id, f_user_id, f_parent_id)
        VALUES ($1, $2, $3, $4)
        RETURNING f_id
      `, [text, analysisId, userId, parentId || null]);
      
      const commentId = insertRes.rows[0].f_id;

      await client.query('COMMIT');

      // Fetch latest user data for return
      const userDataRes = await client.query('SELECT f_nickname, f_image, f_email FROM t_users WHERE f_id = $1', [userId]);
      const userData = userDataRes.rows[0];

      // Return the new comment data so frontend can prepend it immediately
      const newComment = {
        id: commentId,
        text,
        analysisId,
        userId,
        parentId,
        author: userData.f_nickname || (userData.f_email ? userData.f_email.split('@')[0] : '사용자'),
        authorImage: userData.f_image || null,
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
