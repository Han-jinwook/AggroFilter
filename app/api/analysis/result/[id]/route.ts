import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

function normalizeEvaluationReasonScores(
  text: string | null | undefined,
  scores: { accuracy?: unknown; clickbait?: unknown; trust?: unknown }
): string | null {
  if (!text) return text ?? null;
  const accuracy = Number(scores.accuracy);
  const clickbait = Number(scores.clickbait);
  const trust = Number(scores.trust);

  let out = text;

  const clickbaitTierLabel = (() => {
    if (!Number.isFinite(clickbait)) return null;
    if (clickbait <= 20) return '일치/마케팅/훅';
    if (clickbait <= 40) return '과장(오해/시간적 피해/낚임 수준)';
    if (clickbait <= 60) return '왜곡(혼란/짜증)';
    return '허위/조작(실질 손실 가능)';
  })();

  if (Number.isFinite(accuracy)) {
    out = out.replace(
      /(내용\s*정확성\s*검증\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(accuracy)}점)`
    );
  }

  if (Number.isFinite(clickbait)) {
    out = out.replace(
      /(어그로성\s*평가\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(clickbait)}점${clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})`
    );

    if (clickbaitTierLabel && !/2\.\s*어그로성\s*평가[\s\S]*?<br\s*\/>\s*이\s*점수는/g.test(out)) {
      out = out.replace(
        /(2\.\s*어그로성\s*평가[^<]*<br\s*\/>)/,
        `$1이 점수는 '${clickbaitTierLabel}' 구간입니다. `
      );
    }
  }

  if (Number.isFinite(trust)) {
    out = out.replace(
      /(신뢰도\s*총평\s*)\(\s*\d+\s*점/g,
      `$1(${Math.round(trust)}점`
    );
  }

  return out;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  console.log(`Fetching analysis result for ID: ${id}`);

  if (!id) {
    return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      const analysisRes = await client.query(`
        SELECT a.*,
               c.f_title as f_channel_name,
               c.f_thumbnail_url as f_channel_thumbnail,
               c.f_subscriber_count as f_subscriber_count,
               c.f_language as f_channel_language
        FROM t_analyses a 
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        WHERE a.f_id = $1
      `, [id]);

      if (analysisRes.rows.length === 0) {
        return NextResponse.json({ error: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
      }

      const analysis = analysisRes.rows[0];

      let recheckParentScores: { accuracy: number | null; clickbait: number | null; trust: number | null } | null = null;
      const isRecheck = Boolean((analysis as any).f_is_recheck);
      const parentAnalysisId = (analysis as any).f_recheck_parent_analysis_id as string | null;

      if (isRecheck && parentAnalysisId) {
        try {
          const parentRes = await client.query(
            `SELECT f_accuracy_score, f_clickbait_score, f_reliability_score
             FROM t_analyses
             WHERE f_id = $1
             LIMIT 1`,
            [parentAnalysisId]
          );
          if (parentRes.rows.length > 0) {
            const p = parentRes.rows[0];
            recheckParentScores = {
              accuracy: p.f_accuracy_score !== null ? Number(p.f_accuracy_score) : null,
              clickbait: p.f_clickbait_score !== null ? Number(p.f_clickbait_score) : null,
              trust: p.f_reliability_score !== null ? Number(p.f_reliability_score) : null,
            };
          }
        } catch (e) {
          console.error('Error fetching recheck parent scores:', e);
        }
      }

      // Fetch channel stats and ranking
      let channelStats = {
        avgAccuracy: null as number | null,
        avgClickbait: null as number | null,
        avgReliability: null as number | null,
        rank: null as number | null,
        totalChannels: null as number | null,
        topPercentile: null as number | null
      };

      try {
        // Get channel language for ranking calculation
        const channelLanguage = analysis.f_channel_language || 'korean';
        
        // Real-time ranking from t_channel_stats (same source as /api/ranking)
        // Filter by both language AND category for accurate ranking
        const rankingRes = await client.query(`
          WITH Ranked AS (
            SELECT 
              cs.f_channel_id,
              cs.f_avg_reliability,
              RANK() OVER (ORDER BY cs.f_avg_reliability DESC) as rank,
              COUNT(*) OVER () as total_count
            FROM t_channel_stats cs
            JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
            WHERE cs.f_official_category_id = $2
              AND c.f_language = $3
          )
          SELECT rank, total_count,
            ROUND((rank::numeric / total_count) * 100) as top_percentile
          FROM Ranked
          WHERE f_channel_id = $1
        `, [analysis.f_channel_id, analysis.f_official_category_id, channelLanguage]);

        if (rankingRes.rows.length > 0) {
          const rankData = rankingRes.rows[0];
          channelStats.rank = Number(rankData.rank);
          channelStats.totalChannels = Number(rankData.total_count);
          channelStats.topPercentile = Number(rankData.top_percentile);
        }

        const statsRes = await client.query(`
          SELECT f_avg_accuracy, f_avg_clickbait, f_avg_reliability 
          FROM t_channel_stats
          WHERE f_channel_id = $1 AND f_official_category_id = $2
        `, [analysis.f_channel_id, analysis.f_official_category_id]);

        if (statsRes.rows.length > 0) {
          const stats = statsRes.rows[0];
          channelStats.avgAccuracy = stats.f_avg_accuracy !== null ? Math.round(Number(stats.f_avg_accuracy) * 10) / 10 : null;
          channelStats.avgClickbait = stats.f_avg_clickbait !== null ? Math.round(Number(stats.f_avg_clickbait) * 10) / 10 : null;
          channelStats.avgReliability = stats.f_avg_reliability !== null ? Math.round(Number(stats.f_avg_reliability) * 10) / 10 : null;
        } else {
          // Fallback to current analysis scores if no aggregate stats yet
          channelStats.avgAccuracy = analysis.f_accuracy_score ? Math.round(analysis.f_accuracy_score * 10) / 10 : null;
          channelStats.avgClickbait = analysis.f_clickbait_score ? Math.round(analysis.f_clickbait_score * 10) / 10 : null;
          channelStats.avgReliability = analysis.f_reliability_score ? Math.round(analysis.f_reliability_score * 10) / 10 : null;
        }
      } catch (statsError) {
        console.error('Error fetching channel stats:', statsError);
      }
      
      // Fetch comments
      let formattedComments: any[] = [];
      let interaction = {
        likeCount: 0,
        dislikeCount: 0,
        userInteraction: null as 'like' | 'dislike' | null
      };
      
      const { searchParams } = new URL(request.url);
      const userIdFromQuery = searchParams.get('userId');
      let userId = userIdFromQuery;
      if (!userId) {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          userId = data?.user?.id ?? null;
        } catch {
        }
      }

      if (analysis.f_video_id) {
        const commentsRes = await client.query(`
          SELECT c.f_id, c.f_text, c.f_user_id, c.f_parent_id, c.f_created_at,
            u.f_nickname, u.f_image, u.f_email,
            COUNT(CASE WHEN ci.f_type = 'like' THEN 1 END)::int as like_count,
            COUNT(CASE WHEN ci.f_type = 'dislike' THEN 1 END)::int as dislike_count
          FROM t_comments c
          LEFT JOIN t_users u ON c.f_user_id = u.f_id
          LEFT JOIN t_comment_interactions ci ON ci.f_comment_id = c.f_id::text
          WHERE c.f_analysis_id = $1
          GROUP BY c.f_id, c.f_text, c.f_user_id, c.f_parent_id, c.f_created_at,
                   u.f_nickname, u.f_image, u.f_email
          ORDER BY c.f_created_at DESC
        `, [id]);

        const comments = commentsRes.rows;
        const commentMap = new Map();

        comments.forEach(c => {
             const commentObj = {
            id: c.f_id,
            author: c.f_nickname || 'Unknown',
            authorId: c.f_user_id,
            authorEmail: c.f_email || null,
            authorImage: c.f_image || null,
            date: new Date(c.f_created_at).toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1),
            time: new Date(c.f_created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
            text: c.f_text,
            likeCount: parseInt(c.like_count) || 0, 
            dislikeCount: parseInt(c.dislike_count) || 0,
            replies: [],
            replyTo: null 
          };
          commentMap.set(c.f_id, commentObj);
        });

        comments.forEach(c => {
           if (c.f_parent_id) {
            const parent = commentMap.get(c.f_parent_id);
            const child = commentMap.get(c.f_id);
            if (parent && child) {
               child.replyTo = parent.author; 
               parent.replies.push(child);
               parent.replies.sort((a: any, b: any) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());
            }
          } else {
            formattedComments.push(commentMap.get(c.f_id));
          }
        });
      }

      // Fetch interaction data using analysis ID
      const analysisId = analysis.f_id ? String(analysis.f_id) : null;
      if (analysisId) {
        const likeCountRes = await client.query(
          "SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'like'",
          [analysisId]
        );
        const dislikeCountRes = await client.query(
          "SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'dislike'",
          [analysisId]
        );
        interaction.likeCount = parseInt(likeCountRes.rows[0].count, 10);
        interaction.dislikeCount = parseInt(dislikeCountRes.rows[0].count, 10);

        if (userId) {
          const userInteractionRes = await client.query(
            'SELECT f_type FROM t_interactions WHERE f_analysis_id = $1 AND f_user_id = $2',
            [analysisId, userId]
          );
          if (userInteractionRes.rows.length > 0) {
            interaction.userInteraction = userInteractionRes.rows[0].f_type;
          }
        }
      }

      // Fetch user's cumulative prediction stats + this video's prediction
      let userPredictionStats = null;
      let videoPrediction = null;
      if (userId) {
        try {
          const userStatsRes = await client.query(
            `SELECT total_predictions, avg_gap, current_tier, current_tier_label, tier_emoji
             FROM t_users WHERE f_id = $1`,
            [userId]
          );
          if (userStatsRes.rows.length > 0) {
            const u = userStatsRes.rows[0];
            userPredictionStats = {
              totalPredictions: Number(u.total_predictions) || 0,
              avgGap: u.avg_gap !== null ? Number(u.avg_gap) : null,
              currentTier: u.current_tier || null,
              currentTierLabel: u.current_tier_label || null,
              tierEmoji: u.tier_emoji || null,
            };
          }
        } catch (e) {
          console.error('Error fetching user prediction stats:', e);
        }

        // Fetch this video's prediction record from DB
        try {
          const vpRes = await client.query(
            `SELECT predicted_reliability, actual_reliability, gap, tier, tier_label, tier_emoji
             FROM t_prediction_quiz WHERE f_user_id = $1 AND analysis_id = $2`,
            [userId, id]
          );
          if (vpRes.rows.length > 0) {
            const vp = vpRes.rows[0];
            videoPrediction = {
              predictedReliability: Number(vp.predicted_reliability),
              actualReliability: Number(vp.actual_reliability),
              gap: Number(vp.gap),
              tier: vp.tier,
              tierLabel: vp.tier_label,
              tierEmoji: vp.tier_emoji,
            };
          }
        } catch (e) {
          console.error('Error fetching video prediction:', e);
        }
      }

      const resultData = {
        analysisData: {
          // ... (existing fields)
          title: analysis.f_title,
          videoTitle: analysis.f_title,
          videoId: analysis.f_video_id,
          id: analysis.f_id, // Ensure ID is passed
          channelId: analysis.f_channel_id,
          channelName: analysis.f_channel_name || analysis.f_channel_id, 
          channelImage: analysis.f_channel_thumbnail || "/images/channel-logo.png", 
          channelHandle: null,
          subscriberCount: analysis.f_subscriber_count,
          videoThumbnail: analysis.f_thumbnail_url || "/images/video-thumbnail.jpg",
          date: new Date(analysis.f_created_at).toLocaleString('ko-KR'),
          url: analysis.f_video_url,
          topic: analysis.f_topic,
          scores: {
            accuracy: analysis.f_accuracy_score,
            clickbait: analysis.f_clickbait_score,
            trust: analysis.f_reliability_score,
          },
          isRecheck,
          parentAnalysisId: parentAnalysisId,
          recheckParentScores,
          officialCategoryId: analysis.f_official_category_id,
          channelLanguage: analysis.f_channel_language || 'korean',
          channelStats: channelStats,
          summary: analysis.f_summary,
          evaluationReason: normalizeEvaluationReasonScores(analysis.f_evaluation_reason, {
            accuracy: analysis.f_accuracy_score,
            clickbait: analysis.f_clickbait_score,
            trust: analysis.f_reliability_score,
          }),
          overallAssessment: analysis.f_overall_assessment,
          aiRecommendedTitle: analysis.f_ai_title_recommendation,
          fullSubtitle: analysis.f_transcript,
          summarySubtitle: analysis.f_summary,
        },
        comments: formattedComments,
        interaction: interaction,
        userPredictionStats: userPredictionStats,
        videoPrediction: videoPrediction
      };

      return NextResponse.json(resultData);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
