import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gradePrediction } from '@/lib/prediction-grading'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  
  try {
    const body = await request.json()
    const { 
      analysisId, 
      predictedAccuracy, 
      predictedClickbait,
      actualReliability,
      userId: userIdFromBody
    } = body

    let userId = userIdFromBody as string | undefined
    if (!userId) {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (data?.user?.id) userId = data.user.id
      } catch {
      }
    }

    if (!userId) {
      console.log('[prediction/submit] Missing user identification')
      return NextResponse.json({ error: 'User identification is required' }, { status: 401 })
    }

    console.log('[prediction/submit] userId:', userId, 'analysisId:', analysisId, 'predicted:', predictedAccuracy, predictedClickbait, 'actual:', actualReliability)

    if (!analysisId || predictedAccuracy == null || predictedClickbait == null || actualReliability == null) {
      console.log('[prediction/submit] Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = gradePrediction({
      predictedAccuracy,
      predictedClickbait,
      actualReliability
    })

    await client.query('BEGIN')

    // 1. Ensure User exists (if it's an anonId not yet in DB)
    const userRes = await client.query('SELECT f_id, f_email FROM t_users WHERE f_id = $1', [userId]);
    let userEmail = null;
    if (userRes.rows.length === 0) {
      const isAnon = typeof userId === 'string' && userId.startsWith('anon_');
      const nickname = isAnon ? '익명사용자' : '사용자';
      await client.query(`
        INSERT INTO t_users (f_id, f_email, f_nickname, f_created_at, f_updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `, [userId, isAnon ? userId : null, nickname]);
      userEmail = isAnon ? userId : null;
    } else {
      userEmail = userRes.rows[0].f_email;
    }

    // 2. Check for existing prediction using UUID
    const existingCheck = await client.query(
      'SELECT id FROM t_prediction_quiz WHERE f_user_id = $1 AND analysis_id = $2',
      [userId, analysisId]
    )

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ 
        error: 'Already submitted prediction for this video',
        result 
      }, { status: 409 })
    }

    const insertResult = await client.query(
      `INSERT INTO t_prediction_quiz 
       (user_email, analysis_id, predicted_accuracy, predicted_clickbait, predicted_reliability, 
        actual_reliability, gap, tier, tier_label, tier_emoji, f_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userEmail || 'anonymous',
        analysisId,
        predictedAccuracy,
        predictedClickbait,
        result.predictedReliability,
        actualReliability,
        result.gap,
        result.tier,
        result.label,
        result.emoji,
        userId
      ]
    )

    if (userId) {
      const statsResult = await client.query(
        'SELECT gap FROM t_prediction_quiz WHERE f_user_id = $1',
        [userId]
      )

      if (statsResult.rows.length > 0) {
        const totalPredictions = statsResult.rows.length
        const avgGap = statsResult.rows.reduce((sum: number, row: any) => sum + Number(row.gap), 0) / totalPredictions
        
        const bestTierInfo = gradePrediction({
          predictedAccuracy: 50,
          predictedClickbait: 50,
          actualReliability: 50 + avgGap
        })

        // UPDATE: 누적 통계 저장
        await client.query(
          `UPDATE t_users SET 
             current_tier = $1, current_tier_label = $2, tier_emoji = $3,
             total_predictions = $4, avg_gap = $5, f_updated_at = NOW()
           WHERE f_id = $6`,
          [
            bestTierInfo.tier,
            bestTierInfo.label,
            bestTierInfo.emoji,
            totalPredictions,
            Number(avgGap.toFixed(2)),
            userId
          ]
        )
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({ 
      success: true, 
      prediction: insertResult.rows[0],
      result 
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error in prediction submit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
}
