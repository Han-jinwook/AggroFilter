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
      userEmail: userEmailFromBody
    } = body

    let userEmail = userEmailFromBody as string | undefined
    if (!userEmail) {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (data?.user?.email) userEmail = data.user.email
      } catch {
      }
    }

    console.log('[prediction/submit] email:', userEmail, 'analysisId:', analysisId, 'predicted:', predictedAccuracy, predictedClickbait, 'actual:', actualReliability)

    if (!analysisId || predictedAccuracy == null || predictedClickbait == null || actualReliability == null) {
      console.log('[prediction/submit] Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = gradePrediction({
      predictedAccuracy,
      predictedClickbait,
      actualReliability
    })

    const existingCheck = await client.query(
      'SELECT id FROM t_prediction_quiz WHERE user_email = $1 AND analysis_id = $2',
      [userEmail || 'anonymous', analysisId]
    )

    if (existingCheck.rows.length > 0) {
      return NextResponse.json({ 
        error: 'Already submitted prediction for this video',
        result 
      }, { status: 409 })
    }

    await client.query('BEGIN')

    const insertResult = await client.query(
      `INSERT INTO t_prediction_quiz 
       (user_email, analysis_id, predicted_accuracy, predicted_clickbait, predicted_reliability, 
        actual_reliability, gap, tier, tier_label, tier_emoji)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        result.emoji
      ]
    )

    if (userEmail) {
      const statsResult = await client.query(
        'SELECT gap FROM t_prediction_quiz WHERE user_email = $1',
        [userEmail]
      )

      if (statsResult.rows.length > 0) {
        const totalPredictions = statsResult.rows.length
        const avgGap = statsResult.rows.reduce((sum, row) => sum + Number(row.gap), 0) / totalPredictions
        
        const bestTierInfo = gradePrediction({
          predictedAccuracy: 50,
          predictedClickbait: 50,
          actualReliability: 50 + avgGap
        })

        // UPSERT: 로그인/익명 모두 누적 통계 저장
        await client.query(
          `INSERT INTO t_users (f_id, f_email, total_predictions, avg_gap, current_tier, current_tier_label, tier_emoji, f_created_at)
           VALUES ($6, $6, $4, $5, $1, $2, $3, NOW())
           ON CONFLICT (f_email) DO UPDATE SET
             current_tier = $1, current_tier_label = $2, tier_emoji = $3,
             total_predictions = $4, avg_gap = $5`,
          [
            bestTierInfo.tier,
            bestTierInfo.label,
            bestTierInfo.emoji,
            totalPredictions,
            Number(avgGap.toFixed(2)),
            userEmail
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
