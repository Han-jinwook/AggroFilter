import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/user/merge
 * 익명 세션(anon_id) 데이터를 인증된 이메일 계정으로 안전하게 병합합니다.
 * 
 * - t_channel_subscriptions: f_user_id (TEXT = f_email) → email로 변경
 * - t_notifications: f_user_id (TEXT = f_email) → email로 변경
 * - t_interactions: f_user_id (UUID = t_users.f_id) → email 유저의 f_id로 변경
 * - t_comments: f_user_id (UUID = t_users.f_id) → email 유저의 f_id로 변경
 * - t_comment_interactions: f_user_id (UUID) → email 유저의 f_id로 변경
 * - t_analyses: f_user_id (UUID) → email 유저의 f_id로 변경
 * - t_users: anon 행 삭제
 */
export async function POST(request: Request) {
  try {
    const { anonId, email } = await request.json();

    if (!anonId || !email) {
      return NextResponse.json({ error: 'anonId and email are required' }, { status: 400 });
    }

    if (!anonId.startsWith('anon_')) {
      return NextResponse.json({ error: 'Invalid anonId format' }, { status: 400 });
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. anon 유저 조회
      const anonUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_email = $1',
        [anonId]
      );

      if (anonUser.rows.length === 0) {
        // anon 유저가 없으면 merge할 것도 없음
        await client.query('COMMIT');
        return NextResponse.json({ success: true, merged: false, reason: 'No anonymous user found' });
      }

      const anonUserId = anonUser.rows[0].f_id; // UUID

      // 2. email 유저 조회 (없으면 생성)
      let emailUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_email = $1',
        [email]
      );

      let emailUserId: string;
      if (emailUser.rows.length === 0) {
        // email 유저가 아직 없으면 anon 유저를 승격 (가장 깔끔)
        await client.query(
          `UPDATE t_users SET f_email = $1, f_nickname = COALESCE(NULLIF(f_nickname, '익명사용자'), $2), f_updated_at = NOW() WHERE f_id = $3`,
          [email, email.split('@')[0], anonUserId]
        );

        // f_email 기반 테이블도 업데이트
        await client.query(
          'UPDATE t_channel_subscriptions SET f_user_id = $1 WHERE f_user_id = $2',
          [email, anonId]
        );
        await client.query(
          'UPDATE t_notifications SET f_user_id = $1 WHERE f_user_id = $2',
          [email, anonId]
        );

        await client.query('COMMIT');
        console.log(`[merge] Promoted anon user ${anonId} → ${email} (UUID: ${anonUserId})`);
        return NextResponse.json({ success: true, merged: true, method: 'promote', anonUserId });
      }

      emailUserId = emailUser.rows[0].f_id;

      // 3. 두 유저가 모두 존재 → 데이터 이전 후 anon 삭제

      // 3a. t_channel_subscriptions (f_user_id = TEXT/f_email)
      // UNIQUE(f_user_id, f_channel_id) 충돌 방지: 이미 email로 구독 중인 채널은 skip
      await client.query(`
        UPDATE t_channel_subscriptions 
        SET f_user_id = $1 
        WHERE f_user_id = $2 
          AND f_channel_id NOT IN (
            SELECT f_channel_id FROM t_channel_subscriptions WHERE f_user_id = $1
          )
      `, [email, anonId]);
      // 남은 중복 구독은 삭제
      await client.query(
        'DELETE FROM t_channel_subscriptions WHERE f_user_id = $1',
        [anonId]
      );

      // 3b. t_notifications (f_user_id = TEXT/f_email)
      await client.query(
        'UPDATE t_notifications SET f_user_id = $1 WHERE f_user_id = $2',
        [email, anonId]
      );

      // 3c. t_interactions (f_user_id = UUID/f_id)
      // UNIQUE 충돌 방지: 같은 analysis에 대해 이미 email 유저가 interaction 있으면 skip
      await client.query(`
        UPDATE t_interactions 
        SET f_user_id = $1 
        WHERE f_user_id = $2
          AND f_analysis_id NOT IN (
            SELECT f_analysis_id FROM t_interactions WHERE f_user_id = $1
          )
      `, [emailUserId, anonUserId]);
      await client.query(
        'DELETE FROM t_interactions WHERE f_user_id = $1',
        [anonUserId]
      );

      // 3d. t_comments (f_user_id = UUID/f_id) — 단순 이전 (중복 없음)
      await client.query(
        'UPDATE t_comments SET f_user_id = $1 WHERE f_user_id = $2',
        [emailUserId, anonUserId]
      );

      // 3e. t_comment_interactions (f_user_id = UUID/f_id)
      await client.query(`
        UPDATE t_comment_interactions 
        SET f_user_id = $1 
        WHERE f_user_id = $2
          AND f_comment_id NOT IN (
            SELECT f_comment_id FROM t_comment_interactions WHERE f_user_id = $1
          )
      `, [emailUserId, anonUserId]);
      await client.query(
        'DELETE FROM t_comment_interactions WHERE f_user_id = $1',
        [anonUserId]
      );

      // 3f. t_analyses (f_user_id = UUID/f_id) — 단순 이전
      await client.query(
        'UPDATE t_analyses SET f_user_id = $1 WHERE f_user_id = $2',
        [emailUserId, anonUserId]
      );

      // 4. anon 유저 행 삭제
      await client.query('DELETE FROM t_users WHERE f_id = $1', [anonUserId]);

      await client.query('COMMIT');
      console.log(`[merge] Merged anon ${anonId} (${anonUserId}) → ${email} (${emailUserId})`);

      return NextResponse.json({ 
        success: true, 
        merged: true, 
        method: 'transfer',
        anonUserId,
        emailUserId,
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[merge] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
