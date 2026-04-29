import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @deprecated Merlin Family OS ?„í™˜?¼ë¡œ ?µëª… ?¸ì…˜ ë³‘í•© ?œê±°??
 * ?˜ìœ„ ?¸í™˜??no-op stub ???¸ì¶œ ???„ë¬´ ?‘ì—… ?†ì´ ?±ê³µ ë°˜í™˜.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ success: true, merged: false, reason: 'deprecated' });
}

// ?€?€ ?„ë˜???ˆê±°??ì½”ë“œ (ë¹„í™œ?? ?€?€
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

      // 1. anon ? ì? ì¡°íšŒ (f_id ê¸°ì?)
      const anonUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_id = $1',
        [anonId]
      );

      if (anonUser.rows.length === 0) {
        // anon ? ì?ê°€ ?†ìœ¼ë©?merge??ê²ƒë„ ?†ìŒ
        await client.query('COMMIT');
        return NextResponse.json({ success: true, merged: false, reason: 'No anonymous user found' });
      }

      const anonUserId = anonUser.rows[0].f_id;

      // 2. ?¸ì¦??? ì? ì¡°íšŒ (UUID ê¸°ì?)
      let authUser = await client.query(
        'SELECT f_id FROM t_users WHERE f_id = $1',
        [authUserId]
      );

      let emailUserId: string;
      if (authUser.rows.length === 0) {
        // ?¸ì¦ ? ì?ê°€ ?„ì§ ?†ìœ¼ë©?anon ? ì?ë¥??¹ê²© (UUID ? ì?, ?´ë©”?¼ë§Œ ?°ê²°)
        await client.query(
          `UPDATE t_users SET f_email = $1, f_nickname = COALESCE(NULLIF(f_nickname, '?µëª…?¬ìš©??), $2), f_updated_at = NOW() WHERE f_id = $3`,
          [email ?? null, email ? email.split('@')[0] : null, anonUserId]
        );

        await client.query('COMMIT');
        console.log(`[merge] Promoted anon user ${anonId} ??authUserId: ${authUserId}`);
        return NextResponse.json({ success: true, merged: true, method: 'promote', anonUserId });
      }

      emailUserId = authUser.rows[0].f_id;

      // 3. ??? ì?ê°€ ëª¨ë‘ ì¡´ì¬ ???°ì´???´ì „ ??anon ?? œ
      // ëª¨ë“  ?°ì´?°ëŠ” f_user_id (UUID)ë¥?ê¸°ì??¼ë¡œ ì²˜ë¦¬?©ë‹ˆ??

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

      // 3h-pre. anon ? ì????Œë¦¼ ?¤ì •??email ? ì??ê²Œ ë³µì‚¬ (anon??ê¸°ë³¸ê°’ì´ ?„ë‹Œ ê°’ì„ ê°€ì§?ê²½ìš°ë§?
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

      // 3h. ë³‘í•©??? ì????„ì  ?µê³„ ?¬ê³„??      const statsResult = await client.query(
        'SELECT gap FROM t_prediction_quiz WHERE f_user_id = $1',
        [emailUserId]
      );

      if (statsResult.rows.length > 0) {
        const totalPredictions = statsResult.rows.length;
        const avgGap = statsResult.rows.reduce((sum: number, row: any) => sum + Number(row.gap), 0) / totalPredictions;
        
        // ?´ì¦ˆ ?±ê¸‰ ?¬ì‚°??(lib/prediction-grading ë¡œì§ ì°¸ì¡°)
        // ?¤ì œ ?´ì˜ ?œì—??gradePrediction ?¨ìˆ˜ë¥??¬ìš©?˜ê² ì§€ë§? ?¬ê¸°?œëŠ” ê°„ë‹¨??gap ê¸°ë°˜ ?°ì–´ë§??…ë°?´íŠ¸?˜ê±°??
        // ?„ì²´ ?…ë°?´íŠ¸ë¥??˜í–‰?©ë‹ˆ??
        const calculateTier = (gap: number) => {
          if (gap <= 5) return { tier: 'S', label: '?¤ë¼??(Oracle)', emoji: '?‘‘' };
          if (gap <= 15) return { tier: 'A', label: '?©íŠ¸ ?ë…ê¸?, emoji: '?”' };
          if (gap <= 25) return { tier: 'B', label: '?¼ë°˜??, emoji: '?‘¤' };
          if (gap <= 40) return { tier: 'C', label: '?”ë‘ê·€', emoji: '?£' };
          return { tier: 'F', label: '?¸êµ¬ (Sucker)', emoji: '?Ÿ' };
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

      // 4. anon ? ì? ???? œ
      await client.query('DELETE FROM t_users WHERE f_id = $1', [anonUserId]);

      await client.query('COMMIT');
      console.log(`[merge] Merged anon ${anonId} (${anonUserId}) ??authUserId: ${emailUserId}`);

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
