import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId, getVideoInfo, getTranscript } from '@/lib/youtube';
import { analyzeContent } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('분석 요청 URL:', url);

    // 1. YouTube 영상 ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 });
    }

    console.log('영상 ID:', videoId);

    // 2. YouTube API로 영상 정보 가져오기
    const videoInfo = await getVideoInfo(videoId);
    console.log('영상 정보:', videoInfo.title);

    // 3. 자막 추출
    let transcript = '';
    let hasTranscript = false;
    try {
      transcript = await getTranscript(videoId);
      hasTranscript = transcript && transcript.length > 50 && !transcript.includes('가져올 수 없습니다');
      console.log('자막 상태:', hasTranscript ? `성공 (${transcript.length}자)` : '실패');
    } catch (e) {
      console.log('자막 추출 에러:', e);
      hasTranscript = false;
    }
    
    // 자막 가져오기 실패시 고지
    if (!hasTranscript) {
      transcript = '[자막 가져오기 실패] 자막을 불러오는 중 오류가 발생했습니다.';
    }
    console.log('자막 사용 여부:', hasTranscript);

    // 4. Gemini AI 분석 (자막 있을 때만 의미 있음)
    console.log('AI 분석 시작...');
    const analysisResult = await analyzeContent(
      videoInfo.channelName,
      videoInfo.title,
      hasTranscript ? transcript : `[자막 없음 - 제목만으로 분석]\n제목: ${videoInfo.title}`,
      videoInfo.thumbnailUrl
    );
    
    // 자막 가져오기 실패시 점수를 null로 표시
    if (!hasTranscript) {
      analysisResult.accuracy = null as any;
      analysisResult.clickbait = null as any;
      analysisResult.reliability = null as any;
      analysisResult.subtitleSummary = '자막 가져오기에 실패하여 분석이 불가능합니다.';
    }
    console.log('AI 분석 완료:', hasTranscript ? analysisResult.reliability : '자막없음');

    // 5. DB에 저장
    const analysisId = uuidv4();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 5-1. 채널 정보 저장 (Upsert)
      await client.query(`
        INSERT INTO t_channels (f_id, f_name, f_profile_image_url, f_updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (f_id) 
        DO UPDATE SET f_name = EXCLUDED.f_name, f_profile_image_url = EXCLUDED.f_profile_image_url, f_updated_at = NOW()
      `, [videoInfo.channelId, videoInfo.channelName, videoInfo.channelThumbnailUrl]);

      // 5-2. 분석 결과 저장
      await client.query(`
        INSERT INTO t_analyses (
          f_id, f_video_url, f_video_id, f_title, f_channel_name, f_channel_id,
          f_thumbnail_url, f_transcript, f_topic, f_accuracy_score, f_clickbait_score,
          f_reliability_score, f_summary, f_evaluation_reason, f_overall_assessment,
          f_ai_title_recommendation, f_created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
        )
      `, [
        analysisId,
        url,
        videoId,
        videoInfo.title,
        videoInfo.channelName,
        videoInfo.channelId,
        videoInfo.thumbnailUrl,
        transcript.substring(0, 50000),
        analysisResult.topic,
        analysisResult.accuracy,
        analysisResult.clickbait,
        analysisResult.reliability,
        analysisResult.subtitleSummary,
        analysisResult.evaluationReason,
        analysisResult.overallAssessment,
        analysisResult.recommendedTitle
      ]);

      await client.query('COMMIT');
      console.log('DB 저장 완료:', analysisId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      message: '분석이 완료되었습니다.',
      analysisId: analysisId
    });

  } catch (error) {
    console.error('분석 요청 오류:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
