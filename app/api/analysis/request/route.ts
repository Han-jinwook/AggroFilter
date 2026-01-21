import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId, getVideoInfo, getTranscript, getTranscriptItems } from '@/lib/youtube';
import { analyzeContent } from '@/lib/gemini';
import { refreshRankingCache } from '@/lib/ranking_v2';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, userId } = body;

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

      try {
        const checkClient = await pool.connect();
        try {
          const existingAnalysis = await checkClient.query(`
            SELECT f_id, f_reliability_score 
            FROM t_analyses 
            WHERE f_video_id = $1 
            ORDER BY f_created_at DESC 
            LIMIT 1
          `, [videoId]);

          if (existingAnalysis.rows.length > 0) {
            const row = existingAnalysis.rows[0];
            if (row.f_reliability_score !== null && row.f_reliability_score > 0) {
              console.log('이미 분석된 영상입니다. 기존 결과 반환:', row.f_id);
              
              await checkClient.query(`
                UPDATE t_analyses 
                SET f_request_count = COALESCE(f_request_count, 0) + 1,
                    f_view_count = COALESCE(f_view_count, 0) + 1,
                    f_last_action_at = NOW()
                WHERE f_id = $1
              `, [row.f_id]);

              return NextResponse.json({ 
                message: '이미 분석된 영상입니다.',
                analysisId: row.f_id
              });
            }
          }
        } finally {
          checkClient.release();
        }
      } catch (dbError) {
        console.error('Database connection error during check:', dbError);
        // Continue to fresh analysis if check fails
      }

    // 2. YouTube API로 영상 정보 가져오기
    const videoInfo = await getVideoInfo(videoId);
    console.log('영상 정보:', videoInfo.title);

    // 3. 자막 추출
    let transcript = '';
    let transcriptItems: { text: string; start: number; duration: number }[] = [];
    let hasTranscript = false;
    try {
      const items = await getTranscriptItems(videoId);
      if (items.length > 0) {
        transcriptItems = items.map((it) => ({ text: it.text, start: it.offset, duration: it.duration }));
        transcript = items.map((it) => it.text).join(' ');
      } else {
        transcript = await getTranscript(videoId);
      }

      hasTranscript = transcript && transcript.length > 50 && !transcript.includes('가져올 수 없습니다');
      console.log('자막 상태:', hasTranscript ? `성공 (${transcript.length}자, items: ${transcriptItems.length})` : '실패');
    } catch (e) {
      console.error('자막 추출 중 치명적 에러:', e);
      hasTranscript = false;
    }

    // [v2.0 Youtube Native Strategy]
    // AI 재분류(Track A/B) 로직 전면 폐기
    // 유튜브 API가 제공하는 category_id를 절대적 기준으로 사용
    const f_official_category_id = videoInfo.officialCategoryId;
    console.log(`[Youtube Native] Category ID: ${f_official_category_id}`);
    
    // 자막 가져오기 실패시 고지
    if (!hasTranscript) {
      transcript = '[자막 가져오기 실패] 자막을 불러오는 중 오류가 발생했습니다.';
    }
    console.log('자막 사용 여부:', hasTranscript);

    // 4. Gemini AI 분석
    console.log('AI 분석 시작 (모델: gemini-2.0-flash)...');
    let analysisResult;
    try {
      const promptTranscript = hasTranscript ? transcript : `[자막 없음 - 제목만으로 분석]\n제목: ${videoInfo.title}`;
      console.log('AI에게 전달되는 자막 길이:', promptTranscript.length);
      
      analysisResult = await analyzeContent(
        videoInfo.channelName,
        videoInfo.title,
        promptTranscript,
        videoInfo.thumbnailUrl,
        videoInfo.duration,
        transcriptItems
      );
      console.log('AI 분석 데이터 수신 성공');
    } catch (aiError) {
      console.error('AI 분석 엔진 에러:', aiError);
      throw new Error(`AI 분석 중 오류가 발생했습니다: ${aiError.message}`);
    }
    
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
    console.log('DB 저장 시작 (ID:', analysisId, ')');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 5-0. User lookup/creation (if userId/email provided)
      // Note: f_user_id stores email directly (not UUID) to match existing data pattern
      let actualUserId = null;
      if (userId) {
        console.log('5-0. User 확인 중...', userId);
        const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [userId]);
        
        if (userRes.rows.length === 0) {
          // Create user if doesn't exist
          const newUserId = uuidv4();
          await client.query(`
            INSERT INTO t_users (f_id, f_email, f_nickname, f_created_at, f_updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
          `, [newUserId, userId, userId.split('@')[0]]);
          console.log('새 유저 생성:', newUserId);
        }
        // Store email directly in f_user_id
        actualUserId = userId;
      }

      console.log('5-1. 채널 정보 저장 (t_channels)...');
      // 5-1. 채널 정보 저장 (v2.0 필드 반영)
      await client.query(`
        INSERT INTO t_channels (
          f_id, f_name, f_profile_image_url, f_official_category_id, f_subscriber_count
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (f_id) DO UPDATE SET
          f_name = EXCLUDED.f_name,
          f_profile_image_url = EXCLUDED.f_profile_image_url,
          f_official_category_id = EXCLUDED.f_official_category_id,
          f_subscriber_count = EXCLUDED.f_subscriber_count
      `, [
        videoInfo.channelId, 
        videoInfo.channelName, 
        videoInfo.channelThumbnailUrl, 
        videoInfo.officialCategoryId,
        videoInfo.subscriberCount
      ]);

      console.log('5-2. 분석 결과 저장 (t_analyses)...');
      // 5-2. 분석 결과 저장 (v2.0 필드 반영) - f_topic 제거
      await client.query(`
        INSERT INTO t_analyses (
          f_id, f_video_url, f_video_id, f_title, f_channel_id,
          f_thumbnail_url, f_transcript, f_accuracy_score, f_clickbait_score,
          f_reliability_score, f_summary, f_evaluation_reason, f_overall_assessment,
          f_ai_title_recommendation, f_user_id, f_official_category_id,
          f_request_count, f_view_count, f_created_at, f_last_action_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, 1, NOW(), NOW()
        )
      `, [
        analysisId,
        url,
        videoId,
        videoInfo.title,
        videoInfo.channelId,
        videoInfo.thumbnailUrl,
        transcript.substring(0, 50000),
        analysisResult.accuracy,
        analysisResult.clickbait,
        analysisResult.reliability,
        analysisResult.subtitleSummary,
        analysisResult.evaluationReason,
        analysisResult.overallAssessment,
        analysisResult.recommendedTitle,
        actualUserId,
        videoInfo.officialCategoryId
      ]);

      console.log('5-3. 비디오 인덱스 저장 (t_videos)...');
      await client.query(`
        INSERT INTO t_videos (
          f_id, f_channel_id, f_title, f_official_category_id,
          f_accuracy_score, f_clickbait_score, f_trust_score, f_ai_recommended_title,
          f_summary, f_evaluation_reason, f_created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (f_id) DO UPDATE SET
          f_channel_id = EXCLUDED.f_channel_id,
          f_title = EXCLUDED.f_title,
          f_official_category_id = EXCLUDED.f_official_category_id,
          f_accuracy_score = EXCLUDED.f_accuracy_score,
          f_clickbait_score = EXCLUDED.f_clickbait_score,
          f_trust_score = EXCLUDED.f_trust_score,
          f_ai_recommended_title = EXCLUDED.f_ai_recommended_title,
          f_summary = EXCLUDED.f_summary,
          f_evaluation_reason = EXCLUDED.f_evaluation_reason
      `, [
        videoId,
        videoInfo.channelId,
        videoInfo.title,
        f_official_category_id,
        analysisResult.accuracy,
        analysisResult.clickbait,
        analysisResult.reliability,
        analysisResult.recommendedTitle,
        analysisResult.subtitleSummary,
        analysisResult.evaluationReason
      ]);

      // 5-4. 채널 통계 갱신 (카테고리별)
      console.log('5-4. 채널 통계 갱신 시작...');
      if (hasTranscript) {
        await client.query(`
          INSERT INTO t_channel_stats (
            f_channel_id, f_official_category_id, f_video_count, 
            f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
            f_last_updated
          )
          SELECT 
            $1::text, $2::integer, 
            COUNT(*)::integer, 
            ROUND(AVG(f_accuracy_score), 2), 
            ROUND(AVG(f_clickbait_score), 2), 
            ROUND(AVG(f_reliability_score), 2),
            NOW()
          FROM t_analyses
          WHERE f_channel_id = $1 AND f_official_category_id = $2 AND f_reliability_score IS NOT NULL
          GROUP BY f_channel_id, f_official_category_id
          ON CONFLICT (f_channel_id, f_official_category_id) 
          DO UPDATE SET 
            f_video_count = EXCLUDED.f_video_count,
            f_avg_accuracy = EXCLUDED.f_avg_accuracy,
            f_avg_clickbait = EXCLUDED.f_avg_clickbait,
            f_avg_reliability = EXCLUDED.f_avg_reliability,
            f_last_updated = NOW()
        `, [videoInfo.channelId, videoInfo.officialCategoryId]);
      }

      await client.query('COMMIT');
      console.log('DB 저장 완료:', analysisId);

      // [v2.0] 분석 완료 후 백그라운드에서 랭킹 캐시 갱신 (비동기)
      // 특정 카테고리만 갱신하여 효율성 확보
      refreshRankingCache(videoInfo.officialCategoryId).catch(err => {
        console.error('랭킹 캐시 갱신 실패:', err);
      });
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
