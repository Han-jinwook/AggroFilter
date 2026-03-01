import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId, getVideoInfo, getTranscriptItems } from '@/lib/youtube';
import { analyzeContent } from '@/lib/gemini';
import { refreshRankingCache } from '@/lib/ranking_v2';
import { subscribeChannelAuto } from '@/lib/notification';
import { detectLanguageFromText } from '@/lib/language-detection';
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
  let lockClient: any = null;
  let lockedVideoId: string | null = null;
  try {
    const body = await request.json();
    const { url, userId: userIdFromBody, forceRecheck, isRecheck, clientTranscript, clientTranscriptItems } = body;

    let userId = userIdFromBody as string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) userId = data.user.id;
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

        const creditRes = await creditClient.query(
          'SELECT COALESCE(f_recheck_credits, 0) as credits FROM t_users WHERE f_id = $1',
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

      // ── 동시 요청 중복 분석 방지 (Advisory Lock) ──
      try {
        lockClient = await pool.connect();
        await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [videoId]);
        lockedVideoId = videoId;

        const existingAnalysis = await lockClient.query(`
          SELECT f_id, f_reliability_score, f_not_analyzable, f_not_analyzable_reason
          FROM t_analyses 
          WHERE f_video_id = $1 
          ORDER BY f_created_at DESC 
          LIMIT 1
        `, [videoId]);

        if (existingAnalysis.rows.length > 0) {
          const row = existingAnalysis.rows[0];

          // [notAnalyzable 캐시] 이전에 AI가 분석 불가 판정한 영상 -> 즉시 메시지 반환
          if (!forceRecheck && row.f_not_analyzable === true) {
            const cachedReason = row.f_not_analyzable_reason || '분석 불가 콘텐츠';
            console.log(`[notAnalyzable 캐시] 이미 판정된 영상: ${cachedReason}`);

            await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]);
            lockClient.release();
            lockClient = null;
            lockedVideoId = null;

            const reasonMessages: Record<string, string> = {
              '단순 게임 플레이': '단순 게임 플레이 영상은 분석 대상이 아닙니다.\n게임 리뷰·논평·해설 영상은 정상 분석됩니다.',
              '단순 창작물 재생': '단순 창작물 재생(음악·영상 틀어놓기) 영상은 분석 대상이 아닙니다.\n논평·비평·리뷰 영상은 정상 분석됩니다.',
              '하이라이트 모음': '해설 없는 단순 하이라이트 모음 영상은 분석 대상이 아닙니다.\n스포츠 분석·전술 해설 영상은 정상 분석됩니다.',
              '발화 없음': '분석에 필요한 내러이션·논평이 없는 영상입니다.\n실질적인 선택과 논평이 있는 영상을 입력해 주세요.',
            };
            const userMessage = reasonMessages[cachedReason] || `이 영상은 분석 대상이 아닙니다. (${cachedReason})`;

            return NextResponse.json(
              { error: userMessage, notAnalyzable: true, reason: cachedReason },
              { status: 422, headers: corsHeaders }
            );
          }

          if (!forceRecheck && row.f_reliability_score !== null && row.f_reliability_score > 0) {
            console.log('이미 분석된 영상입니다. 기존 결과 반환:', row.f_id);
            
            await lockClient.query(`
              UPDATE t_analyses 
              SET f_request_count = COALESCE(f_request_count, 0) + 1,
                  f_view_count = COALESCE(f_view_count, 0) + 1,
                  f_last_action_at = NOW()
              WHERE f_id = $1
            `, [row.f_id]);

            await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]);
            lockClient.release();
            lockClient = null;
            lockedVideoId = null;

            return NextResponse.json({ 
              message: '이미 분석된 영상입니다.',
              analysisId: row.f_id
            }, { headers: corsHeaders });
          }
        }
      } catch (lockError) {
        console.error('Advisory lock/check error:', lockError);
        if (lockClient) {
          await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]).catch(() => {});
          lockClient.release();
          lockClient = null;
          lockedVideoId = null;
        }
        // Continue to fresh analysis if lock/check fails
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

    // [Filter] 입구컷: 분석 가치가 없는 영상 유형을 제목 키워드로 즉시 차단 (비용 절감)
    // 카테고리는 절대 다루지 않음: 음악평론·게임리뷰도 분석 대상
    const titleLower = (videoInfo.title || '').toLowerCase();

    // 1. 단순 음악 영상 (MV, Official Video 등)
    const musicKeywords = [
      ' m/v', '(m/v)', '[m/v]',
      ' mv)', '(mv)', '[mv]',
      'official video', 'official m/v', 'official mv',
      'lyric video', 'lyrics video',
      'music video',
      'official audio',
      '뮤직비디오',
      '노래 가사',
      '가사 영상',
    ];
    if (musicKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '단순 음악 영상(M/V, Official Video 등)은 분석 대상이 아닙니다.\n음악 평론·인터뷰·연주 영상은 정상 분석됩니다.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 2. 라이브/생방송 (게임 라이브, 방송 다시보기 등)
    const liveKeywords = [
      '라이브', '생방송', '생중계', '실시간 방송',
      ' live', '(live)', '[live]',
      'live stream', 'livestream',
      '다시보기', '풀영상', '전편',
    ];
    if (liveKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '라이브·생방송·다시보기 영상은 분석 대상이 아닙니다.\n편집된 리뷰·논평 영상은 정상 분석됩니다.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 3. 단순 줄거리 요약/결말 (논평 없이 내용만 압축)
    const summaryKeywords = [
      '줄거리 요약', '내용 요약', '줄거리 정리',
      '결말 정리', '결말 요약', '결말 포함',
      '스토리 요약', '내용 정리', '편 요약',
      '몰아보기', '전체 줄거리',
    ];
    if (summaryKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '단순 줄거리 요약·결말 정리 영상은 분석 대상이 아닙니다.\n영화·드라마 논평·비평 영상은 정상 분석됩니다.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 4. 단순 콘텐츠 재생 (카테고리 + 키워드 조합, 논평/리뷰 키워드 있으면 통과)
    const officialCategoryId = videoInfo.officialCategoryId?.toString();
    const reviewKeywords = [
      '리뷰', '분석', '비판', '논란', '문제', '평가',
      '추천', '비교', '역대', '최고', '최악', '랭킹',
      '해설', '논평', '의미', '시사',
    ];
    const hasReviewKw = reviewKeywords.some(kw => titleLower.includes(kw));

    // 게임(20): 단순 플레이
    if (officialCategoryId === '20' && !hasReviewKw) {
      const gamePlayKeywords = [
        '플레이', 'gameplay', 'game play',
        '풀게임', '풀플레이',
        '솔로랭크', '솔랭', '칼바람', '배틀그라운드',
        '클리어', '엔딩', '공략',
      ];
      if (gamePlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '단순 게임 플레이 영상은 분석 대상이 아닙니다.\n게임 리뷰·논평·비평 영상은 정상 분석됩니다.' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // 스포츠(17): 단순 경기 중계/풀매치
    if (officialCategoryId === '17' && !hasReviewKw) {
      const sportsPlayKeywords = [
        '풀게임', '풀매치', '전리플', '실제경기',
        'full match', 'full game',
        '중계', '직캐스트', '라이브 중계',
      ];
      if (sportsPlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '단순 스포츠 중계/풀매치 영상은 분석 대상이 아닙니다.\n스포츠 분석·전술 해설·리뷰 영상은 정상 분석됩니다.' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // 필름/애니(1): 단순 영화/드라마 재생
    if (officialCategoryId === '1' && !hasReviewKw) {
      const filmPlayKeywords = [
        '전편 보기', '풀버전', '전편 스트림',
        'full movie', 'full film', 'full episode',
        '전편보기', '전체 보기',
      ];
      if (filmPlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '단순 영화/드라마 재생 영상은 분석 대상이 아닙니다.\n영화·드라마 논평·비평·리뷰 영상은 정상 분석됩니다.' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // 엔터테인먼트(24): 공연/콘서트 단순 재생
    if (officialCategoryId === '24' && !hasReviewKw) {
      const entertainPlayKeywords = [
        '콘서트 영상', '콘서트 전편', '전체 공연',
        'full concert', 'full performance', 'full show',
        '공연 영상', '공연 전편',
      ];
      if (entertainPlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '단순 공연/콘서트 재생 영상은 분석 대상이 아닙니다.\n콘서트 리뷰·공연 비평 영상은 정상 분석됩니다.' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    if (clientTranscript && typeof clientTranscript === 'string' && clientTranscript.length > 50) {
      // 크롬 확장팩/모바일 앱에서 보낸 자막 사용
      transcript = clientTranscript;
      transcriptItems = Array.isArray(clientTranscriptItems) ? clientTranscriptItems : [];
      hasTranscript = true;
      console.log(`클라이언트 자막 사용: ${transcript.length}자, items: ${transcriptItems.length}`);
    } else {
      // 서버에서 자막 추출 시도 (1회)
      try {
        const items = await getTranscriptItems(videoId);
        if (items.length > 0) {
          transcriptItems = items.map((it) => ({ text: it.text, start: it.offset, duration: it.duration }));
          transcript = items.map((it) => it.text).join(' ');
        }

        hasTranscript = transcript && transcript.length > 50 && !transcript.includes('가져올 수 없습니다');
        console.log('자막 상태:', hasTranscript ? `성공 (${transcript.length}자, items: ${transcriptItems.length})` : '자막 없음');
      } catch (e) {
        console.error('자막 추출 중 에러:', e);
        hasTranscript = false;
      }
    }

    // [v2.0 Youtube Native Strategy]
    // AI 재분류(Track A/B) 로직 전면 폐기
    // 유튜브 API가 제공하는 category_id를 절대적 기준으로 사용
    const f_official_category_id = videoInfo.officialCategoryId;
    console.log(`[Youtube Native] Category ID: ${f_official_category_id}`);
    
    // [v3.1 Global Ranking] 3단계 언어 감지 Fallback
    let finalLanguage = videoInfo.language; // Step 1: YouTube API
    let languageSource = videoInfo.languageSource || 'unknown';
    
    // Step 2: 자막 기반 언어 감지 (Plan B - 핵심 무기)
    if (!finalLanguage && hasTranscript && transcriptItems.length > 0) {
      const firstText = transcriptItems[0].text;
      finalLanguage = detectLanguageFromText(firstText);
      languageSource = 'transcript';
      console.log(`[Language Detection] Step 2 (Transcript): ${finalLanguage}`);
    }
    
    // Step 3: 기본값 (Plan C)
    if (!finalLanguage) {
      finalLanguage = 'ko'; // 기본값
      languageSource = 'user';
      console.log(`[Language Detection] Step 3 (Default): ${finalLanguage}`);
    }
    
    console.log(`[Language Detection] Final: ${finalLanguage} (source: ${languageSource})`);
    
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
    console.log('AI 분석 시작...');
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
    
    // [notAnalyzable 판정] AI가 분석 가치 없는 영상으로 판정한 경우
    if (analysisResult?.notAnalyzable === true) {
      const reason = analysisResult.notAnalyzableReason || '분석 불가 콘텐츠';
      console.log(`[notAnalyzable] AI 판정: ${reason} - DB 저장 후 거절`);

      // DB에 저장 (재요청 시 캐시 응답을 위해)
      const naClient = await pool.connect();
      try {
        await naClient.query('BEGIN');
        await naClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_not_analyzable BOOLEAN DEFAULT FALSE`);
        await naClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_not_analyzable_reason TEXT`);

        // t_videos 저장 (metadata만)
        await naClient.query(`
          INSERT INTO t_videos (
            f_video_id, f_channel_id, f_title, f_published_at,
            f_thumbnail_url, f_official_category_id, f_view_count, f_created_at, f_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (f_video_id) DO UPDATE SET
            f_title = EXCLUDED.f_title,
            f_view_count = EXCLUDED.f_view_count,
            f_updated_at = NOW()
        `, [
          videoId,
          videoInfo.channelId,
          videoInfo.title,
          videoInfo.publishedAt || null,
          videoInfo.thumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0
        ]);

        // t_analyses에 notAnalyzable 레코드 저장
        await naClient.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_user_id, f_official_category_id,
            f_request_count, f_view_count, f_created_at, f_last_action_at,
            f_is_latest, f_not_analyzable, f_not_analyzable_reason
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            1, $9, NOW(), NOW(),
            TRUE, TRUE, $10
          )
          ON CONFLICT DO NOTHING
        `, [
          uuidv4(),
          url,
          videoId,
          videoInfo.title,
          videoInfo.channelId,
          videoInfo.thumbnailUrl,
          userId || null,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0,
          reason
        ]);

        await naClient.query('COMMIT');
      } catch (dbErr) {
        await naClient.query('ROLLBACK');
        console.error('[notAnalyzable] DB 저장 실패 (뭔시):', dbErr);
      } finally {
        naClient.release();
      }

      const reasonMessages: Record<string, string> = {
        '단순 게임 플레이': '단순 게임 플레이 영상은 분석 대상이 아닙니다.\n게임 리뷰·논평·해설 영상은 정상 분석됩니다.',
        '단순 창작물 재생': '단순 창작물 재생(음악·영상 틀어놓기) 영상은 분석 대상이 아닙니다.\n논평·비평·리뷰 영상은 정상 분석됩니다.',
        '하이라이트 모음': '해설 없는 단순 하이라이트 모음 영상은 분석 대상이 아닙니다.\n스포츠 분석·전술 해설 영상은 정상 분석됩니다.',
        '발화 없음': '분석에 필요한 내러이션·논평이 없는 영상입니다.\n실질적인 선택과 논평이 있는 영상을 입력해 주세요.',
      };
      const userMessage = reasonMessages[reason] || `이 영상은 분석 대상이 아닙니다. (${reason})`;

      return NextResponse.json(
        { error: userMessage, notAnalyzable: true, reason },
        { status: 422, headers: corsHeaders }
      );
    }

    // 자막 없는 영상: AI가 제목+썬네일로 분석한 점수는 유지, 자막 요약만 표시 변경
    if (!hasTranscript && !analysisResult.subtitleSummary?.includes('자막 없음')) {
      analysisResult.subtitleSummary = '자막 없음 - 제목 및 썬네일 기반 분석';
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
    console.log('AI 분석 완료:', analysisResult.reliability, hasTranscript ? '' : '(자막없음-제목/썸네일 기반)');

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

      // 5-0. User lookup/creation (if userId provided)
      let actualUserId = userId || null;
      if (actualUserId) {
        console.log('5-0. User 확인 중...', actualUserId);
        const userRes = await client.query('SELECT f_id FROM t_users WHERE f_id = $1', [actualUserId]);
        if (userRes.rows.length === 0) {
          // If the user doesn't exist in t_users, they might be an anonymous user from local storage
          // In the clean UUID approach, we should have the user in t_users.
          // However, for safety with existing anonId, we can still upsert if it looks like a valid ID.
          const isAnon = typeof actualUserId === 'string' && actualUserId.startsWith('anon_');
          const nickname = isAnon ? '익명사용자' : '사용자';
          await client.query(`
            INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (f_id) DO NOTHING
          `, [actualUserId, null, nickname, null]);
        }
      }

      console.log('5-1. 채널 정보 저장 (t_channels)...');
      // 5-1. 채널 정보 저장 (v2.0 필드 반영)
      await client.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);

      console.log('5-1-1. 비디오 기본 정보 저장 (t_videos)...');
      await client.query(`
        INSERT INTO t_videos (
          f_video_id, f_channel_id, f_title, f_description, f_published_at,
          f_thumbnail_url, f_official_category_id, f_view_count, f_created_at, f_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (f_video_id) DO UPDATE SET
          f_title = EXCLUDED.f_title,
          f_description = EXCLUDED.f_description,
          f_published_at = EXCLUDED.f_published_at,
          f_thumbnail_url = EXCLUDED.f_thumbnail_url,
          f_official_category_id = EXCLUDED.f_official_category_id,
          f_view_count = EXCLUDED.f_view_count,
          f_updated_at = NOW()
      `, [
        videoId,
        videoInfo.channelId,
        videoInfo.title,
        videoInfo.description,
        videoInfo.publishedAt || null,
        videoInfo.thumbnailUrl,
        videoInfo.officialCategoryId,
        videoInfo.viewCount || 0
      ]);

      await client.query(`
        INSERT INTO t_channels (
          f_channel_id,
          f_title,
          f_thumbnail_url,
          f_official_category_id,
          f_subscriber_count,
          f_language
        ) VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6)
        ON CONFLICT (f_channel_id) DO UPDATE SET
          f_title = COALESCE(NULLIF(EXCLUDED.f_title, ''), t_channels.f_title),
          f_thumbnail_url = COALESCE(EXCLUDED.f_thumbnail_url, t_channels.f_thumbnail_url),
          f_official_category_id = EXCLUDED.f_official_category_id,
          f_subscriber_count = EXCLUDED.f_subscriber_count,
          f_language = COALESCE(EXCLUDED.f_language, t_channels.f_language)
      `, [
        videoInfo.channelId, 
        videoInfo.channelName, 
        videoInfo.channelThumbnailUrl, 
        videoInfo.officialCategoryId,
        videoInfo.subscriberCount,
        finalLanguage
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
            f_is_latest, f_language,
            f_grounding_used, f_grounding_queries
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            1, $23, NOW(), NOW(),
            $17, $18, $19,
            TRUE, $20,
            $21, $22
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
          isRecheck ? new Date() : null,
          finalLanguage,
          Boolean(analysisResult.groundingUsed),
          analysisResult.groundingQueries?.length > 0 ? analysisResult.groundingQueries : null,
          videoInfo.viewCount || 0
        ]);

        // [v3.3] t_videos 로직 제거 - t_analyses와 t_channel_stats만 사용
      }

      // 5-4. 채널 통계 갱신 (카테고리별 + 언어별)
      console.log('5-4. 채널 통계 갱신 시작 (언어별 분리)...');
      if (hasTranscript) {
        // [v3.0] 언어별 통계 분리: 채널+카테고리+언어 3차원 관리
        await client.query(`
          INSERT INTO t_channel_stats (
            f_channel_id, f_official_category_id, f_language, f_video_count, 
            f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
            f_last_updated
          )
          SELECT 
            a.f_channel_id, a.f_official_category_id, COALESCE(a.f_language, 'korean') as language,
            COUNT(*)::integer, 
            ROUND(AVG(a.f_accuracy_score), 2), 
            ROUND(AVG(a.f_clickbait_score), 2), 
            ROUND(AVG(a.f_reliability_score), 2),
            NOW()
          FROM t_analyses a
          WHERE a.f_channel_id = $1 
            AND a.f_official_category_id = $2 
            AND COALESCE(a.f_language, 'korean') = $3
            AND a.f_reliability_score IS NOT NULL
            AND a.f_is_latest = TRUE
          GROUP BY a.f_channel_id, a.f_official_category_id, COALESCE(a.f_language, 'korean')
          ON CONFLICT (f_channel_id, f_official_category_id, f_language) 
          DO UPDATE SET 
            f_video_count = EXCLUDED.f_video_count,
            f_avg_accuracy = EXCLUDED.f_avg_accuracy,
            f_avg_clickbait = EXCLUDED.f_avg_clickbait,
            f_avg_reliability = EXCLUDED.f_avg_reliability,
            f_last_updated = NOW()
        `, [videoInfo.channelId, videoInfo.officialCategoryId, finalLanguage]);
      }

      if (isRecheck) {
        if (!actualUserId) {
          throw new Error('로그인이 필요합니다.');
        }
        const creditRes = await client.query(
          `UPDATE t_users
           SET f_recheck_credits = COALESCE(f_recheck_credits, 0) - 1,
               f_updated_at = NOW()
           WHERE f_id = $1 AND COALESCE(f_recheck_credits, 0) > 0
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

      await refreshRankingCache(videoInfo.officialCategoryId)
        .catch(err => {
          console.error('랭킹 캐시 갱신 실패:', err);
        });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Release advisory lock after DB save
    if (lockClient && lockedVideoId) {
      await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockedVideoId]).catch(() => {});
      lockClient.release();
      lockClient = null;
      lockedVideoId = null;
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
    if (lockClient && lockedVideoId) {
      await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockedVideoId]).catch(() => {});
      lockClient.release();
      lockClient = null;
      lockedVideoId = null;
    }
    console.error('분석 요청 오류:', error);
    const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500;
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.' 
    }, { status: statusCode, headers: corsHeaders });
  }
}
