import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family OS 전환으로 익명 세션 병합 제거됨.
 * 하위 호환용 no-op stub — 호출 시 아무 작업 없이 성공 반환.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ success: true, merged: false, reason: 'deprecated' });
}

// ── 아래는 레거시 코드 (비활성) ──
async function _legacy_POST(request: Request) {
  try {
    const { anonId, userId: authUserId, email } = await request.json();

    if (!anonId || !authUserId) {
      return NextResponse.json({ error: 'anonId and userId are required' }, { status: 400 });
    }

    if (!anonId.startsWith('anon_')) {
      return NextResponse.json({ error: 'Invalid anonId format' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. anon 유저 조회 (f_id 기준)
      const anonUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_id = $1',
        [anonId]
      );

      if (anonUser.rows.length === 0) {
        // anon 유저가 없으면 merge할 것도 없음
        await client.query('COMMIT');
        return NextResponse.json({ success: true, merged: false, reason: 'No anonymous user found' });
      }

      const anonUserId = anonUser.rows[0].f_id;

      // 2. 인증된 유저 조회 (UUID 기준)
      let authUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_id = $1',
        [authUserId]
      );

      let emailUserId: string;
      if (authUser.rows.length === 0) {
        // 인증 유저가 아직 없으면 anon 유저를 승격 (UUID 유지, 이메일만 연결)
        await client.query(
          `UPDATE t_users SET f_email = $1, f_nickname = COALESCE(NULLIF(f_nickname, '익명사용자'), $2), f_updated_at = NOW() WHERE f_id = $3`,
          [email ?? null, email ? email.split('@')[0] : null, anonUserId]
        );

        await client.query('COMMIT');
        console.log(`[merge] Promoted anon user ${anonId} → authUserId: ${authUserId}`);
        return NextResponse.json({ success: true, merged: true, method: 'promote', anonUserId });
      }

      emailUserId = authUser.rows[0].f_id;

      // 3. 두 유저가 모두 존재 → 데이터 이전 후 anon 삭제
      // 모든 데이터는 f_user_id (UUID)를 기준으로 처리됩니다.

      // 3a. t_channel_subscriptions
      await client.query(`
        UPDATE t_channel_subscriptions 
        SET f_user_id = $1 
        WHERE f_user_id = $2 
          AND f_channel_id NOT IN (
            SELECT f_channel_id FROM t_channel_subscriptions WHERE f_user_id = $1
          )
      `, [emailUserId, anonUserId]);
      await client.query('DELETE FROM t_channel_subscriptions WHERE f_user_id = $1', [anonUserId]);

      // 3b. t_notifications
      await client.query('UPDATE t_notifications SET f_user_id = $1 WHERE f_user_id = $2', [emailUserId, anonUserId]);

      // 3c. t_interactions
      await client.query(`
        UPDATE t_interactions 
        SET f_user_id = $1 
        WHERE f_user_id = $2
          AND f_analysis_id NOT IN (
            SELECT f_analysis_id FROM t_interactions WHERE f_user_id = $1
          )
      `, [emailUserId, anonUserId]);
      await client.query('DELETE FROM t_interactions WHERE f_user_id = $1', [anonUserId]);

      // 3d. t_comments
      await client.query('UPDATE t_comments SET f_user_id = $1 WHERE f_user_id = $2', [emailUserId, anonUserId]);

      // 3e. t_comment_interactions
      await client.query(`
        UPDATE t_comment_interactions 
        SET f_user_id = $1 
        WHERE f_user_id = $2
          AND f_comment_id NOT IN (
            SELECT f_comment_id FROM t_comment_interactions WHERE f_user_id = $1
          )
      `, [emailUserId, anonUserId]);
      await client.query('DELETE FROM t_comment_interactions WHERE f_user_id = $1', [anonUserId]);

      // 3f. t_analyses
      await client.query('UPDATE t_analyses SET f_user_id = $1 WHERE f_user_id = $2', [emailUserId, anonUserId]);

      // 3g. t_prediction_quiz
      await client.query('UPDATE t_prediction_quiz SET f_user_id = $1 WHERE f_user_id = $2', [emailUserId, anonUserId]);

      // 3h-pre. anon 유저의 알림 설정을 email 유저에게 복사 (anon이 기본값이 아닌 값을 가진 경우만)
      const anonSettings = await client.query(`
        SELECT f_ranking_threshold, f_notify_grade_change, f_notify_ranking_change, f_notify_top10_change
        FROM t_users WHERE f_id = $1
      `, [anonUserId]);
      if (anonSettings.rows.length > 0) {
        const s = anonSettings.rows[0];
        const updates: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        if (s.f_ranking_threshold !== null && s.f_ranking_threshold !== 10) {
          updates.push(`f_ranking_threshold = $${idx++}`); vals.push(s.f_ranking_threshold);
        }
        if (s.f_notify_grade_change === false) {
          updates.push(`f_notify_grade_change = $${idx++}`); vals.push(false);
        }
        if (s.f_notify_ranking_change === false) {
          updates.push(`f_notify_ranking_change = $${idx++}`); vals.push(false);
        }
        if (s.f_notify_top10_change === false) {
          updates.push(`f_notify_top10_change = $${idx++}`); vals.push(false);
        }
        if (updates.length > 0) {
          vals.push(emailUserId);
          await client.query(`UPDATE t_users SET ${updates.join(', ')} WHERE f_id = $${idx}`, vals);
        }
      }

      // 3h. 병합된 유저의 누적 통계 재계산
      const statsResult = await client.query(
        'SELECT gap FROM t_prediction_quiz WHERE f_user_id = $1',
        [emailUserId]
      );

      if (statsResult.rows.length > 0) {
        const totalPredictions = statsResult.rows.length;
        const avgGap = statsResult.rows.reduce((sum: number, row: any) => sum + Number(row.gap), 0) / totalPredictions;
        
        // 퀴즈 등급 재산정 (lib/prediction-grading 로직 참조)
        // 실제 운영 시에는 gradePrediction 함수를 사용하겠지만, 여기서는 간단히 gap 기반 티어만 업데이트하거나 
        // 전체 업데이트를 수행합니다.
        const calculateTier = (gap: number) => {
          if (gap <= 5) return { tier: 'S', label: '오라클 (Oracle)', emoji: '👑' };
          if (gap <= 15) return { tier: 'A', label: '팩트 판독기', emoji: '🔍' };
          if (gap <= 25) return { tier: 'B', label: '일반인', emoji: '👤' };
          if (gap <= 40) return { tier: 'C', label: '팔랑귀', emoji: '🎣' };
          return { tier: 'F', label: '호구 (Sucker)', emoji: '🐟' };
        };

        const tierInfo = calculateTier(avgGap);

        await client.query(
          `UPDATE t_users SET 
             total_predictions = $1, 
             avg_gap = $2, 
             current_tier = $3, 
             current_tier_label = $4, 
             tier_emoji = $5,
             f_updated_at = NOW()
           WHERE f_id = $6`,
          [
            totalPredictions,
            Number(avgGap.toFixed(2)),
            tierInfo.tier,
            tierInfo.label,
            tierInfo.emoji,
            emailUserId
          ]
        );
      }

      // 4. anon 유저 행 삭제
      await client.query('DELETE FROM t_users WHERE f_id = $1', [anonUserId]);

      await client.query('COMMIT');
      console.log(`[merge] Merged anon ${anonId} (${anonUserId}) → authUserId: ${emailUserId}`);

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
