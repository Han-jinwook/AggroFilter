import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

async function getUserId(client: any, email: string) {
  const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }
  return userRes.rows[0].f_id;
}

async function getVideoIdFromAnalysisId(client: any, analysisId: string) {
  const res = await client.query('SELECT f_video_id FROM t_analyses WHERE f_id = $1 LIMIT 1', [analysisId]);
  if (res.rows.length === 0 || !res.rows[0]?.f_video_id) {
    throw new Error('Analysis not found');
  }
  return String(res.rows[0].f_video_id);
}

export async function POST(request: Request) {
  const { videoId: videoIdFromBody, analysisId, type, email: emailFromBody } = await request.json();

  let email = emailFromBody as string | undefined;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user?.email) email = data.user.email;
  } catch {
  }

  if (!type || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (type !== 'like' && type !== 'dislike') {
    return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const videoId =
      (typeof videoIdFromBody === 'string' && videoIdFromBody.length > 0)
        ? videoIdFromBody
        : (typeof analysisId === 'string' && analysisId.length > 0)
          ? await getVideoIdFromAnalysisId(client, analysisId)
          : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userId = await getUserId(client, email);

    const existingInteraction = await client.query(
      'SELECT f_id, f_type FROM t_interactions WHERE f_user_id = $1 AND f_video_id = $2',
      [userId, videoId]
    );

    if (existingInteraction.rows.length > 0) {
      const currentType = existingInteraction.rows[0].f_type;
      if (currentType === type) {
        // Toggle off: delete the interaction
        await client.query('DELETE FROM t_interactions WHERE f_id = $1', [existingInteraction.rows[0].f_id]);
      } else {
        // Switch type: update the existing interaction
        await client.query('UPDATE t_interactions SET f_type = $1, f_updated_at = NOW() WHERE f_id = $2', [
          type,
          existingInteraction.rows[0].f_id,
        ]);
      }
    } else {
      // New interaction: insert it
      await client.query(
        'INSERT INTO t_interactions (f_user_id, f_video_id, f_type) VALUES ($1, $2, $3)',
        [userId, videoId, type]
      );
    }

    // Fetch the new counts
    const likeCountRes = await client.query(
      "SELECT COUNT(*) FROM t_interactions WHERE f_video_id = $1 AND f_type = 'like'",
      [videoId]
    );
    const dislikeCountRes = await client.query(
      "SELECT COUNT(*) FROM t_interactions WHERE f_video_id = $1 AND f_type = 'dislike'",
      [videoId]
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
