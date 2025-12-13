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
        SELECT a.*, c.f_profile_image_url 
        FROM t_analyses a 
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_id 
        WHERE a.f_id = $1
      `, [id]);

      if (analysisRes.rows.length === 0) {
        return NextResponse.json({ error: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
      }

      const analysis = analysisRes.rows[0];
      
      const resultData = {
        analysisData: {
          title: analysis.f_title,
          videoTitle: analysis.f_title,
          channelName: analysis.f_channel_name,
          channelImage: analysis.f_profile_image_url || "/images/channel-logo.png",
          videoThumbnail: analysis.f_thumbnail_url || "/images/video-thumbnail.jpg",
          date: new Date(analysis.f_created_at).toLocaleString('ko-KR'),
          url: analysis.f_video_url,
          topic: analysis.f_topic,
          scores: {
            accuracy: analysis.f_accuracy_score,
            clickbait: analysis.f_clickbait_score,
            trust: analysis.f_reliability_score,
          },
          summary: analysis.f_summary,
          evaluationReason: analysis.f_evaluation_reason,
          overallAssessment: analysis.f_overall_assessment,
          aiRecommendedTitle: analysis.f_ai_title_recommendation,
          fullSubtitle: analysis.f_transcript,
          summarySubtitle: analysis.f_summary,
        },
        comments: [],
        interaction: {
          likeCount: 0,
          dislikeCount: 0,
        }
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
