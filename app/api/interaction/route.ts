import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

async function getOrCreateUserId(client: any, userId: string) {
  const userRes = await client.query('SELECT f_id FROM t_users WHERE f_id = $1', [userId]);
  if (userRes.rows.length > 0) {
    return userRes.rows[0].f_id;
  }
  // Auto-create user (supports anon_id)
  const isAnon = userId.startsWith('anon_');
  const nickname = isAnon ? '익명사용자' : '사용자';
  await client.query(
    `INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [userId, isAnon ? userId : null, nickname, null]
  );
  return userId;
}


export async function POST(request: Request) {
  const { analysisId, type, userId: userIdFromBody } = await request.json();

  let userId = userIdFromBody as string | undefined;
  if (!userId) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
    } catch {
    }
  }

  if (!type || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (type !== 'like' && type !== 'dislike') {
    return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!analysisId) {
      return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
    }

    const userIdFinal = await getOrCreateUserId(client, userId);

    const existingInteraction = await client.query(
      'SELECT f_id, f_type FROM t_interactions WHERE f_user_id = $1 AND f_analysis_id = $2',
      [userIdFinal, analysisId]
    );

    if (existingInteraction.rows.length > 0) {
      const currentType = existingInteraction.rows[0].f_type;
      if (currentType === type) {
        // Toggle off: delete the interaction
        await client.query('DELETE FROM t_interactions WHERE f_id = $1', [existingInteraction.rows[0].f_id]);
      } else {
        // Switch type: update the existing interaction
        await client.query('UPDATE t_interactions SET f_type = $1 WHERE f_id = $2', [
          type,
          existingInteraction.rows[0].f_id,
        ]);
      }
    } else {
      // New interaction: insert it
      await client.query(
        'INSERT INTO t_interactions (f_user_id, f_analysis_id, f_type) VALUES ($1, $2, $3)',
        [userIdFinal, analysisId, type]
      );
    }

    // Fetch the new counts
    const likeCountRes = await client.query(
      "SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'like'",
      [analysisId]
    );
    const dislikeCountRes = await client.query(
      "SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'dislike'",
      [analysisId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      likeCount: parseInt(likeCountRes.rows[0].count, 10),
      dislikeCount: parseInt(dislikeCountRes.rows[0].count, 10),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Interaction Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
