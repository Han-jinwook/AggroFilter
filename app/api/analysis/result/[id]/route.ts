import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

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
               COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as f_name,
               COALESCE(to_jsonb(c)->>'f_profile_image_url', to_jsonb(c)->>'f_thumbnail_url') as f_profile_image_url,
               (to_jsonb(c)->>'f_subscriber_count')::bigint as f_subscriber_count,
               COALESCE(to_jsonb(c)->>'f_handle', NULL) as f_handle
        FROM t_analyses a 
        LEFT JOIN t_channels c ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
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
        const rankingRes = await client.query(`
          SELECT f_rank, f_total_count, f_top_percentile
          FROM t_rankings_cache
          WHERE f_channel_id = $1 AND f_category_id = $2
        `, [analysis.f_channel_id, analysis.f_official_category_id]);

        if (rankingRes.rows.length > 0) {
          const rankData = rankingRes.rows[0];
          channelStats.rank = Number(rankData.f_rank);
          channelStats.totalChannels = Number(rankData.f_total_count);
          channelStats.topPercentile = Number(rankData.f_top_percentile);
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
      const email = searchParams.get('email');

      if (analysis.f_video_id) {
        // ... (existing comments fetching code) ...
        const commentsRes = await client.query(`
          SELECT c.*, u.f_nickname, u.f_image
          FROM t_comments c
          JOIN t_users u ON c.f_user_id = u.f_id
          WHERE c.f_video_id = $1
          ORDER BY c.f_created_at DESC
        `, [analysis.f_video_id]);

        // ... (existing comments processing code) ...
        const comments = commentsRes.rows;
        const commentMap = new Map();

        comments.forEach(c => {
            // ...
             const commentObj = {
            id: c.f_id,
            author: c.f_nickname || 'Unknown',
            authorId: c.f_user_id,
            date: new Date(c.f_created_at).toLocaleDateString("ko-KR").replace(/\. /g, ".").slice(0, -1),
            time: new Date(c.f_created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
            text: c.f_text,
            likes: 0, 
            dislikes: 0,
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

      // Fetch interaction data using analysis ID (f_id)
      const likeCountRes = await client.query("SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'like'", [id]);
      const dislikeCountRes = await client.query("SELECT COUNT(*) FROM t_interactions WHERE f_analysis_id = $1 AND f_type = 'dislike'", [id]);
      interaction.likeCount = parseInt(likeCountRes.rows[0].count, 10);
      interaction.dislikeCount = parseInt(dislikeCountRes.rows[0].count, 10);

      if (email) {
          const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
          if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].f_id;
            const userInteractionRes = await client.query(
              'SELECT f_type FROM t_interactions WHERE f_analysis_id = $1 AND f_user_id = $2',
              [id, userId]
            );
            if (userInteractionRes.rows.length > 0) {
              interaction.userInteraction = userInteractionRes.rows[0].f_type;
            }
          }
      }

      const resultData = {
        analysisData: {
          // ... (existing fields)
          title: analysis.f_title,
          videoTitle: analysis.f_title,
          videoId: analysis.f_video_id,
          id: analysis.f_id, // Ensure ID is passed
          channelName: analysis.f_name, 
          channelImage: analysis.f_profile_image_url || "/images/channel-logo.png", 
          channelHandle: analysis.f_handle,
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
          channelStats: channelStats,
          summary: analysis.f_summary,
          evaluationReason: analysis.f_evaluation_reason,
          overallAssessment: analysis.f_overall_assessment,
          aiRecommendedTitle: analysis.f_ai_title_recommendation,
          fullSubtitle: analysis.f_transcript,
          summarySubtitle: analysis.f_summary,
        },
        comments: formattedComments,
        interaction: interaction
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
