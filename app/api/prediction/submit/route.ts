import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gradePrediction } from '@/lib/prediction-grading'

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
      userEmail
    } = body

    if (!analysisId || predictedAccuracy == null || predictedClickbait == null || actualReliability == null) {
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

        await client.query(
          `UPDATE t_users 
           SET current_tier = $1, current_tier_label = $2, tier_emoji = $3, 
               total_predictions = $4, avg_gap = $5
           WHERE email = $6`,
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
