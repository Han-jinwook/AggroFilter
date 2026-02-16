import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId, getVideoInfo, getTranscript, getTranscriptItems } from '@/lib/youtube';
import { analyzeContent } from '@/lib/gemini';
import { refreshRankingCache } from '@/lib/ranking_v2';
import { subscribeChannelAuto, checkRankingChangesAndNotify } from '@/lib/notification';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

// CORS 헤더 (크롬 확장팩 등 외부 origin 허용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

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
      `$1(${Math.round(clickbait)}점)`
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, userId: userIdFromBody, forceRecheck, isRecheck, clientTranscript, clientTranscriptItems } = body;

    let userId = userIdFromBody as string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) userId = data.user.email;
    } catch {
    }

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400, headers: corsHeaders });
    }

    console.log('분석 요청 URL:', url);

    // 1. YouTube 영상 ID 추출
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400, headers: corsHeaders });
    }

    console.log('영상 ID:', videoId);

    if (isRecheck) {
      if (!userId) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: corsHeaders });
      }

      const creditClient = await pool.connect();
      try {
        await creditClient.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`);

        const userRes = await creditClient.query('SELECT f_id FROM t_users WHERE f_email = $1', [userId]);
        if (userRes.rows.length === 0) {
          const newUserId = uuidv4();
          await creditClient.query(
            `INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [newUserId, userId, userId.split('@')[0], null]
          );
        }

        const creditRes = await creditClient.query(
          'SELECT COALESCE(f_recheck_credits, 0) as credits FROM t_users WHERE f_email = $1',
          [userId]
        );
        const credits = creditRes.rows.length > 0 ? Number(creditRes.rows[0].credits) : 0;
        if (!Number.isFinite(credits) || credits <= 0) {
          return NextResponse.json({ error: '크레딧이 부족합니다.' }, { status: 402, headers: corsHeaders });
        }
      } finally {
        creditClient.release();
      }
    }

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
            if (!forceRecheck && row.f_reliability_score !== null && row.f_reliability_score > 0) {
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
              }, { headers: corsHeaders });
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

    let recheckParentAnalysisId: string | null = null;
    let recheckParentTrust: number | null = null;
    if (isRecheck) {
      const gateClient = await pool.connect();
      try {
        const latestRes = await gateClient.query(
          `SELECT f_id, f_title, f_thumbnail_url, f_reliability_score
           FROM t_analyses
           WHERE f_video_id = $1
           ORDER BY f_created_at DESC
           LIMIT 1`,
          [videoId]
        );

        if (latestRes.rows.length > 0) {
          const latest = latestRes.rows[0];
          recheckParentAnalysisId = latest.f_id;
          recheckParentTrust = typeof latest.f_reliability_score === 'number' ? latest.f_reliability_score : null;

          const prevTitle = (latest.f_title || '').trim();
          const prevThumb = (latest.f_thumbnail_url || '').trim();
          const curTitle = (videoInfo.title || '').trim();
          const curThumb = (videoInfo.thumbnailUrl || '').trim();

          const isSameTitle = prevTitle.length > 0 && curTitle.length > 0 && prevTitle === curTitle;
          const isSameThumb = prevThumb.length > 0 && curThumb.length > 0 && prevThumb === curThumb;
          if (isSameTitle && isSameThumb) {
            return NextResponse.json(
              { error: '썸네일/제목 수정이 없어 재심을 할 수 없습니다.' },
              { status: 409, headers: corsHeaders }
            );
          }
        }
      } finally {
        gateClient.release();
      }
    }

    // 3. 자막 추출 (클라이언트에서 보낸 자막이 있으면 우선 사용)
    let transcript = '';
    let transcriptItems: { text: string; start: number; duration: number }[] = [];
    let hasTranscript = false;

    if (clientTranscript && typeof clientTranscript === 'string' && clientTranscript.length > 50) {
      // 크롬 확장팩/모바일 앱에서 보낸 자막 사용
      transcript = clientTranscript;
      transcriptItems = Array.isArray(clientTranscriptItems) ? clientTranscriptItems : [];
      hasTranscript = true;
      console.log(`클라이언트 자막 사용: ${transcript.length}자, items: ${transcriptItems.length}`);
    } else {
      // 서버에서 자막 추출 시도
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

    if (isRecheck && !hasTranscript) {
      const err: any = new Error('자막을 가져오지 못해 재검수가 불가능합니다.');
      err.statusCode = 422;
      throw err;
    }

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
        transcriptItems,
        videoInfo.publishedAt
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

    const accuracyNum = typeof analysisResult?.accuracy === 'number' ? analysisResult.accuracy : null;
    const clickbaitNum = typeof analysisResult?.clickbait === 'number' ? analysisResult.clickbait : null;
    if (accuracyNum !== null && clickbaitNum !== null) {
      const computed = Math.round((accuracyNum + (100 - clickbaitNum)) / 2);
      analysisResult.reliability = Math.max(0, Math.min(100, computed));
    }

    if (typeof analysisResult?.evaluationReason === 'string') {
      analysisResult.evaluationReason =
        normalizeEvaluationReasonScores(analysisResult.evaluationReason, {
          accuracy: analysisResult.accuracy,
          clickbait: analysisResult.clickbait,
          trust: analysisResult.reliability,
        }) ?? analysisResult.evaluationReason;
    }
    console.log('AI 분석 완료:', hasTranscript ? analysisResult.reliability : '자막없음');

    const shouldKeepParentOnDecrease =
      Boolean(isRecheck) &&
      Boolean(recheckParentAnalysisId) &&
      typeof analysisResult?.reliability === 'number' &&
      typeof recheckParentTrust === 'number' &&
      analysisResult.reliability < recheckParentTrust;

    // 5. DB에 저장
    const analysisId = uuidv4();
    console.log('DB 저장 시작 (ID:', analysisId, ')');
    const client = await pool.connect();
    
    let creditDeducted = false;

    try {
      await client.query('BEGIN');

      await client.query(`ALTER TABLE t_users ADD COLUMN IF NOT EXISTS f_recheck_credits INTEGER DEFAULT 0`);

      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_is_recheck BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_parent_analysis_id TEXT`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_at TIMESTAMP`);

      // 5-0. User lookup/creation (if userId/email provided)
      // Supports both email users and anonymous (anon_*) users
      let actualUserId = null;
      const isAnon = typeof userId === 'string' && userId.startsWith('anon_');
      if (userId) {
        console.log('5-0. User 확인 중...', userId, isAnon ? '(익명)' : '(이메일)');
        if (isAnon) {
          // 익명 사용자: t_users에 anon_id로 저장
          const anonRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [userId]);
          if (anonRes.rows.length === 0) {
            const newUserId = uuidv4();
            await client.query(`
              INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
            `, [newUserId, userId, '익명사용자', null]);
            console.log('익명 유저 생성:', newUserId);
          }
          actualUserId = userId;
        } else {
          // 이메일 사용자
          const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [userId]);
          if (userRes.rows.length === 0) {
            const newUserId = uuidv4();
            await client.query(`
              INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
            `, [newUserId, userId, userId.split('@')[0], null]);
            console.log('새 유저 생성:', newUserId);
          }
          actualUserId = userId;
        }
      }

      console.log('5-1. 채널 정보 저장 (t_channels)...');
      // 5-1. 채널 정보 저장 (v2.0 필드 반영)
      await client.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);

      await client.query(`
        INSERT INTO t_channels (
          f_channel_id,
          f_title,
          f_thumbnail_url,
          f_official_category_id,
          f_subscriber_count
        ) VALUES ($1, $2, NULLIF($3, ''), $4, $5)
        ON CONFLICT (f_channel_id) DO UPDATE SET
          f_title = COALESCE(NULLIF(EXCLUDED.f_title, ''), t_channels.f_title),
          f_thumbnail_url = COALESCE(EXCLUDED.f_thumbnail_url, t_channels.f_thumbnail_url),
          f_official_category_id = EXCLUDED.f_official_category_id,
          f_subscriber_count = EXCLUDED.f_subscriber_count
      `, [
        videoInfo.channelId, 
        videoInfo.channelName, 
        videoInfo.channelThumbnailUrl, 
        videoInfo.officialCategoryId,
        videoInfo.subscriberCount
      ]);

      if (!shouldKeepParentOnDecrease) {
        console.log('5-2. 분석 결과 저장 (t_analyses)...');
        
        // [v2.2 Optimization] Mark previous records as not latest
        await client.query(`
          UPDATE t_analyses 
          SET f_is_latest = FALSE 
          WHERE f_video_id = $1
        `, [videoId]);

        // 5-2. 분석 결과 저장 (v2.0 필드 반영) - f_topic 제거
        await client.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_transcript, f_accuracy_score, f_clickbait_score,
            f_reliability_score, f_summary, f_evaluation_reason, f_overall_assessment,
            f_ai_title_recommendation, f_user_id, f_official_category_id,
            f_request_count, f_view_count, f_created_at, f_last_action_at,
            f_is_recheck, f_recheck_parent_analysis_id, f_recheck_at,
            f_is_latest
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            1, 1, NOW(), NOW(),
            $17, $18, $19,
            TRUE
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
          videoInfo.officialCategoryId,
          Boolean(isRecheck),
          isRecheck ? recheckParentAnalysisId : null,
          isRecheck ? new Date() : null
        ]);

        console.log('5-3. 비디오 인덱스 저장 (t_videos)...');
        // Ensure v2 columns exist on t_videos (safe no-op if already migrated)
        await client.query(`
          ALTER TABLE t_videos
          ADD COLUMN IF NOT EXISTS f_official_category_id INT,
          ADD COLUMN IF NOT EXISTS f_custom_category_id INT,
          ADD COLUMN IF NOT EXISTS f_accuracy_score INT,
          ADD COLUMN IF NOT EXISTS f_clickbait_score INT,
          ADD COLUMN IF NOT EXISTS f_trust_score INT,
          ADD COLUMN IF NOT EXISTS f_ai_recommended_title TEXT,
          ADD COLUMN IF NOT EXISTS f_summary TEXT,
          ADD COLUMN IF NOT EXISTS f_evaluation_reason TEXT,
          ADD COLUMN IF NOT EXISTS f_published_at TIMESTAMPTZ;
        `);
        await client.query(`
          INSERT INTO t_videos (
            f_video_id,
            f_channel_id,
            f_title,
            f_official_category_id,
            f_accuracy_score,
            f_clickbait_score,
            f_trust_score,
            f_ai_recommended_title,
            f_summary,
            f_evaluation_reason,
            f_thumbnail_url,
            f_published_at,
            f_created_at,
            f_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (f_video_id) DO UPDATE SET
            f_channel_id = EXCLUDED.f_channel_id,
            f_title = EXCLUDED.f_title,
            f_official_category_id = EXCLUDED.f_official_category_id,
            f_accuracy_score = EXCLUDED.f_accuracy_score,
            f_clickbait_score = EXCLUDED.f_clickbait_score,
            f_trust_score = EXCLUDED.f_trust_score,
            f_ai_recommended_title = EXCLUDED.f_ai_recommended_title,
            f_summary = EXCLUDED.f_summary,
            f_evaluation_reason = EXCLUDED.f_evaluation_reason,
            f_thumbnail_url = COALESCE(EXCLUDED.f_thumbnail_url, t_videos.f_thumbnail_url),
            f_published_at = COALESCE(EXCLUDED.f_published_at, t_videos.f_published_at),
            f_updated_at = NOW()
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
          analysisResult.evaluationReason,
          videoInfo.thumbnailUrl,
          videoInfo.publishedAt || null
        ]);
      }

      // 5-4. 채널 통계 갱신 (카테고리별)
      console.log('5-4. 채널 통계 갱신 시작...');
      if (hasTranscript) {
        // [v2.2 Optimization] Use f_is_latest = true instead of complex CTE
        await client.query(`
          INSERT INTO t_channel_stats (
            f_channel_id, f_official_category_id, f_video_count, 
            f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
            f_last_updated
          )
          SELECT 
            f_channel_id, f_official_category_id,
            COUNT(*)::integer, 
            ROUND(AVG(f_accuracy_score), 2), 
            ROUND(AVG(f_clickbait_score), 2), 
            ROUND(AVG(f_reliability_score), 2),
            NOW()
          FROM t_analyses
          WHERE f_channel_id = $1 
            AND f_official_category_id = $2 
            AND f_reliability_score IS NOT NULL
            AND f_is_latest = TRUE
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

      if (isRecheck) {
        if (!actualUserId) {
          throw new Error('로그인이 필요합니다.');
        }
        const creditRes = await client.query(
          `UPDATE t_users
           SET f_recheck_credits = COALESCE(f_recheck_credits, 0) - 1,
               f_updated_at = NOW()
           WHERE f_email = $1 AND COALESCE(f_recheck_credits, 0) > 0
           RETURNING f_recheck_credits`,
          [actualUserId]
        );

        if (creditRes.rows.length === 0) {
          const err: any = new Error('크레딧이 부족합니다.');
          err.statusCode = 402;
          throw err;
        }

        creditDeducted = true;
      }

      // 5-5. 채널 구독 처리
      if (actualUserId && hasTranscript) {
        console.log('5-5. 채널 구독 처리 시작...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS t_channel_subscriptions (
            f_id BIGSERIAL PRIMARY KEY,
            f_user_id TEXT NOT NULL,
            f_channel_id TEXT NOT NULL,
            f_subscribed_at TIMESTAMP DEFAULT NOW(),
            f_last_rank INT,
            f_last_rank_checked_at TIMESTAMP,
            f_last_reliability_grade VARCHAR(10),
            f_last_reliability_score INT,
            f_last_top10_percent_status BOOLEAN DEFAULT FALSE,
            f_notification_enabled BOOLEAN DEFAULT TRUE,
            UNIQUE(f_user_id, f_channel_id)
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_user_id ON t_channel_subscriptions(f_user_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_channel_id ON t_channel_subscriptions(f_channel_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_notification
          ON t_channel_subscriptions(f_notification_enabled)
          WHERE f_notification_enabled = TRUE;
        `);

        await client.query(
          `INSERT INTO t_channel_subscriptions (f_user_id, f_channel_id, f_subscribed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (f_user_id, f_channel_id) DO NOTHING;`,
          [actualUserId, videoInfo.channelId]
        );
        console.log('구독 처리 완료');
      }

      await client.query('COMMIT');
      console.log('DB 저장 완료:', analysisId);

      // [v2.0] 분석 완료 후 백그라운드에서 랭킹 캐시 갱신 → 변동 감지 (순서 보장)
      refreshRankingCache(videoInfo.officialCategoryId)
        .then(() => {
          if (actualUserId && hasTranscript) {
            return checkRankingChangesAndNotify(videoInfo.officialCategoryId);
          }
        })
        .catch(err => {
          console.error('랭킹 캐시 갱신/변동 감지 실패:', err);
        });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const finalAnalysisId = shouldKeepParentOnDecrease && recheckParentAnalysisId ? recheckParentAnalysisId : analysisId;

    return NextResponse.json({ 
      message: shouldKeepParentOnDecrease
        ? '재검 결과 신뢰도 점수가 하락하여 기존 분석 결과를 유지합니다.'
        : '분석이 완료되었습니다.',
      analysisId: finalAnalysisId,
      creditDeducted,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('분석 요청 오류:', error);
    const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500;
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.' 
    }, { status: statusCode, headers: corsHeaders });
  }
}
