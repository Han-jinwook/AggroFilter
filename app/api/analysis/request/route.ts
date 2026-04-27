import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId, getVideoInfo, getTranscriptItems } from '@/lib/youtube';
import { analyzeContent } from '@/lib/gemini';
import { analyzeContentSpeed } from '@/lib/gemini-speed';
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

const ENSURE_CREDIT_HISTORY = `
  CREATE TABLE IF NOT EXISTS t_credit_history (
    f_id BIGSERIAL PRIMARY KEY,
    f_user_id TEXT NOT NULL,
    f_type TEXT NOT NULL,
    f_amount INTEGER NOT NULL,
    f_balance INTEGER NOT NULL,
    f_description TEXT,
    f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`;

async function ensureCreditHistoryTable(client: any) {
  await client.query(ENSURE_CREDIT_HISTORY);
}

async function getLatestCreditBalance(client: any, userId: string): Promise<number> {
  const res = await client.query(
    `SELECT f_balance
     FROM t_credit_history
     WHERE f_user_id = $1
     ORDER BY f_id DESC
     LIMIT 1`,
    [userId]
  );
  if (res.rows.length === 0) return 0;
  const balance = Number(res.rows[0].f_balance);
  return Number.isFinite(balance) ? balance : 0;
}

async function appendCreditHistory(
  client: any,
  params: { userId: string; amount: number; description: string; type?: string }
): Promise<number> {
  const currentBalance = await getLatestCreditBalance(client, params.userId);
  const nextBalance = currentBalance + params.amount;
  await client.query(
    `INSERT INTO t_credit_history (f_user_id, f_type, f_amount, f_balance, f_description)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.userId, params.type || 'analysis', params.amount, nextBalance, params.description]
  );
  return nextBalance;
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
    // Try to replace existing score first
    const replaced = out.replace(
      /(내용\s*정확성\s*검증\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(accuracy)}점)`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(1\.\s*내용\s*정확성\s*검증)(:)/,
        `$1 (${Math.round(accuracy)}점)$2`
      );
    } else {
      out = replaced;
    }
  }

  if (Number.isFinite(clickbait)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(어그로성\s*평가\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(clickbait)}점${clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(2\.\s*어그로성\s*평가)(:)/,
        `$1 (${Math.round(clickbait)}점${clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})$2`
      );
    } else {
      out = replaced;
    }

    if (clickbaitTierLabel && !/2\.\s*어그로성\s*평가[\s\S]*?<br\s*\/>\s*이\s*점수는/g.test(out)) {
      out = out.replace(
        /(2\.\s*어그로성\s*평가[^<]*<br\s*\/>)/,
        `$1이 점수는 '${clickbaitTierLabel}' 구간입니다. `
      );
    }
  }

  if (Number.isFinite(trust)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(신뢰도\s*총평\s*)\(\s*\d+\s*점/g,
      `$1(${Math.round(trust)}점`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(3\.\s*신뢰도\s*총평)(:)/,
        `$1 (${Math.round(trust)}점)$2`
      );
    } else {
      out = replaced;
    }
  }

  return out;
}

export async function POST(request: Request) {
  let lockClient: any = null;
  let lockedVideoId: string | null = null;
  try {
    const body = await request.json();
    const { url, userId: userIdFromBody, forceRecheck, isRecheck, clientTranscript, clientTranscriptItems } = body;

    // 사용자 브라우저 언어 감지 (Accept-Language 헤더)
    const acceptLanguage = request.headers.get('accept-language') || '';
    const userLanguage = acceptLanguage.toLowerCase().includes('ko') ? 'korean' : 'english';

    const userIdFromBodyStr = typeof userIdFromBody === 'string' ? userIdFromBody : undefined;
    let userId = userIdFromBodyStr;
    try {
      if (!userId) {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) userId = data.user.id;
      }
    } catch {
    }

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400, headers: corsHeaders });
    }

    console.log('분석 요청 URL:', url);

    // 1. YouTube 영상 ID 추출
    const videoId = extractVideoId(url)?.trim();
    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400, headers: corsHeaders });
    }

    console.log('영상 ID:', videoId);

    if (isRecheck) {
      if (!userId || userId.startsWith('anon_')) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: corsHeaders });
      }

      // REFACTORED_BY_MERLIN_HUB: t_users 크레딧 → Hub wallet 이관 예정
      const creditClient = await pool.connect();
      try {
        await ensureCreditHistoryTable(creditClient);
        const credits = await getLatestCreditBalance(creditClient, userId);
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
          SELECT f_id, f_reliability_score, f_not_analyzable, f_not_analyzable_reason, f_processing_stage
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
              { error: userMessage, notAnalyzable: true, reason: cachedReason, cached: true },
              { status: 422, headers: corsHeaders }
            );
          }

          if (!forceRecheck && (row.f_processing_stage === 'speed_ready' || row.f_processing_stage === 'pending')) {
            console.log('이미 진행 중인 분석입니다. 기존 분석 ID 재사용:', row.f_id, row.f_processing_stage);

            await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]);
            lockClient.release();
            lockClient = null;
            lockedVideoId = null;

            return NextResponse.json({
              message: '이미 분석이 진행 중입니다. 기존 결과를 불러옵니다.',
              analysisId: row.f_id,
              cached: true,
              processingStage: row.f_processing_stage,
            }, { headers: corsHeaders });
          }

          if (!forceRecheck && row.f_reliability_score !== null && row.f_reliability_score > 0) {
            console.log('이미 분석된 영상입니다. 기존 결과 반환:', row.f_id);

            // ── 캐시 히트에도 크레딧 차감 (유료 콘텐츠 열람 Paywall) ──
            // REFACTORED_BY_MERLIN_HUB: t_users 크레딧 차감 → Hub wallet 이관 예정
            let cachedCreditDeducted = false;
            if (userId && !userId.startsWith('anon_') && !userId.startsWith('trial_')) {
              await ensureCreditHistoryTable(lockClient);
              const userCredits = await getLatestCreditBalance(lockClient, userId);
              if (!Number.isFinite(userCredits) || userCredits < 30) {
                await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]);
                lockClient.release();
                lockClient = null;
                lockedVideoId = null;
                return NextResponse.json(
                  { error: '크레딧이 부족합니다. 충전 후 다시 시도해주세요.', insufficientCredits: true, redirectUrl: '/payment/mock' },
                  { status: 402, headers: corsHeaders }
                );
              }

              const newBalance = await appendCreditHistory(lockClient, {
                userId,
                amount: -30,
                description: '영상 분석 (캐시)',
                type: 'analysis',
              });
              cachedCreditDeducted = true;
              console.log(`[Credit·Cache] userId=${userId}, -30C → balance=${newBalance}`);
            }

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
              analysisId: row.f_id,
              cached: true,
              creditDeducted: cachedCreditDeducted,
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

    // ── 크레딧 잔액 체크 (새 분석 시에만, 캐시 히트는 무료) ──
    if (!isRecheck && userId && !userId.startsWith('anon_')) {
      const creditCheckClient = await pool.connect();
      try {
        // REFACTORED_BY_MERLIN_HUB: t_users 크레딧 조회 → Hub wallet 이관 예정
        await ensureCreditHistoryTable(creditCheckClient);
        const userCredits = await getLatestCreditBalance(creditCheckClient, userId);
        if (!Number.isFinite(userCredits) || userCredits < 30) {
          return NextResponse.json(
            { error: '크레딧이 부족합니다. 충전 후 다시 시도해주세요.', insufficientCredits: true, redirectUrl: '/payment/mock' },
            { status: 402, headers: corsHeaders }
          );
        }
      } finally {
        creditCheckClient.release();
      }
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

    // [Filter] 입구컷: 분석 가치가 없는 영상 유형을 즉시 차단 (비용 절감)
    const titleLower = (videoInfo.title || '').toLowerCase();

    // 0. 카테고리 화이트리스트 기반 즉시 차단 (AI 분석 이전 — 비용 절감 및 빠른 거절)
    // AutoMarketer와 동일한 핵심 7개 카테고리만 허용: 22,24,25,26,27,28,29
    const officialCategoryId = videoInfo.officialCategoryId?.toString();
    const allowedCategoryIds = new Set(['22', '24', '25', '26', '27', '28', '29']);
    const blockedCategoryMessages: Record<string, string> = {
      '10': '음악(M/V, 음원) 카테고리 영상은 분석 대상이 아닙니다.\n음악 평론·비평 영상은 정상 분석됩니다.',
      '1': '영화/애니메이션 재생 영상은 분석 대상이 아닙니다.\n영화 리뷰·비평 영상은 정상 분석됩니다.',
      '2': '자동차/이동수단 카테고리 영상은 분석 대상이 아닙니다.\n자동차 리뷰·비교 영상은 정상 분석됩니다.',
      '15': '반려동물/동물 카테고리 영상은 분석 대상이 아닙니다.',
      '17': '스포츠 단순 경기/하이라이트 영상은 분석 대상이 아닙니다.\n스포츠 분석·전술 해설 영상은 정상 분석됩니다.',
      '19': '여행/이벤트 카테고리 영상은 분석 대상이 아닙니다.\n여행 정보·리뷰 영상은 정상 분석됩니다.',
      '20': '게임 카테고리 영상은 분석 대상이 아닙니다.\n게임 리뷰·논평·비평 영상은 정상 분석됩니다.',
      '23': '코미디/유머 카테고리 영상은 분석 대상이 아닙니다.',
      '43': '방송(Shows) 카테고리 영상은 분석 대상이 아닙니다.',
    };
    if (!officialCategoryId || !allowedCategoryIds.has(officialCategoryId)) {
      const msg = blockedCategoryMessages[officialCategoryId || ''] ||
        '현재 분석 가능한 카테고리가 아닙니다.\n(허용 카테고리: 인물/블로그, 엔터테인먼트, 뉴스/정치, 노하우/스타일, 교육, 과학/기술, 비영리/사회)';
      return NextResponse.json({ error: msg }, { status: 422, headers: corsHeaders });
    }

    // 1. 단순 음악 영상 (MV, Official Video 등) — 카테고리 무관 키워드 차단
    const musicKeywords = [
      ' m/v', '(m/v)', '[m/v]',
      ' mv)', '(mv)', '[mv]',
      '[mv]', '(mv)', ' mv ',
      'official video', 'official m/v', 'official mv',
      'lyric video', 'lyrics video',
      'music video',
      'official audio',
      '뮤직비디오',
      '노래 가사',
      '가사 영상',
      'special clip', 'live clip',
      '主題歌', '挿入歌', // 일본어 주제가, 삽입곡
      'utattemita', '歌ってみた', // 불러보았다 (커버)
      '弾いてみた', // 연주해보았다
      'dance practice', '안무 영상',
      'lyrics', '가사', 'karaoke', '(inst)', '[inst]', 'instrumental',
      'remix', 'prod by', ' feat.', ' ft.',
      '자막판',
    ];
    if (musicKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '단순 음악 영상(M/V, Official Video 등)은 분석 대상이 아닙니다.\n음악 평론·인터뷰·연주 영상은 정상 분석됩니다.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 2. 라이브/생방송/하이라이트 (단순 재생 영상)
    const liveKeywords = [
      '라이브', '생방송', '생중계', '실시간 방송',
      ' live', '(live)', '[live]',
      'live stream', 'livestream', 'streaming', 'streamer', '스트리밍', '스트리머',
      '다시보기', '풀영상', '전편', '녹화본', '방송분', '(녹)',
      '무대영상', '공연영상', '콘서트', 'fancam', '직캠',
      '하이라이트', '풀 하이라이트', 'highlight', 'highlights',
      ' h/l', '[h/l]', '(h/l)', ' hl ', '[hl]', '(hl)',
      '득점장면', '골장면', '명장면', '주요장면', '전반전', '후반전',
      '모든 골', '전경기', '경기 요약',
      '정주행', '연속보기', '모음집', '모음', '클립', 'clips',
      '실시간', '방송중', '달립시다', '탐방',
      '역대급', '최신판', '멸망전', '대회', '스크림', '내전', '자랭',
    ];
    if (liveKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '라이브·생방송·하이라이트 영상은 분석 대상이 아닙니다.\n편집된 리뷰·논평 영상은 정상 분석됩니다.' },
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
    const reviewKeywords = [
      '리뷰', '분석', '비판', '논란', '문제', '평가',
      '추천', '비교', '최고', '최악', '랭킹',
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
        '육성', '강화', '러쉬', '노가다', '파밍',
        '리니지', '리니지m', '리니지w', '리니지2m', '리니지클래식',
        '메이플', '메이플스토리', '로아', '로스트아크', '던파', '던전앤파이터',
        '롤', 'league of legends', 'lol', 'tft', '전략적 팀 전투',
        '배그', 'pubg', '발로란트', 'valorant',
        '오버워치', 'overwatch', 'minecraft', '마인크래프트',
        '티어올리기',
        '요들', '거인 요들', '2중 성장', '뽑기', '지배뽑기',
        '서든어택', '서든', 'sudden attack', '철권', 'tekken',
        '피파', 'fc온라인', 'fconline', '스타', '스타크래프트',
        '기가 막힌 타이밍', '타이밍',
        '생존 시단', '혼입', '흑롭법사',
      ];
      if (gamePlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '단순 게임 플레이 영상은 분석 대상이 아닙니다.\n게임 리뷰·논평·비평 영상은 정상 분석됩니다.' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // 스포츠(17): 단순 경기 중계/풀매치/패턴 기반 하이라이트
    if (officialCategoryId === '17' && !hasReviewKw) {
      const sportsPlayKeywords = [
        '풀게임', '풀매치', '전리플', '실제경기',
        'full match', 'full game',
        '중계', '직캐스트', '라이브 중계',
        '라운드', ' round', ' r ',
      ];
      // [v3.5] 팀 vs 팀 형태의 단순 경기 영상 차단 (리뷰 키워드 없을 때)
      const hasVsPattern = titleLower.includes(' vs ') || titleLower.includes(' vs. ') || titleLower.includes(' v ');
      const hasRoundPattern = /\d+r\s/.test(titleLower) || /\d+라운드/.test(titleLower);

      // 공식 채널성 이름 감지
      const channelName = (videoInfo.channelName || '').toLowerCase();
      const isOfficialSportsChannel = [
        '쿠팡플레이', 'coupang play', 'sbs', 'kbs', 'mbc', 'tvn', 'jtbc', 'spotv', '스포티비',
        'k리그', 'kleague', 'kfa', '축구협회', 'kbo', 'kbl', 'kovo', 'v리그', 'v-league',
        '공식채널', 'official', 'sports', '스포츠', 'tv조선', '채널a', 'mbn'
      ].some(kw => channelName.includes(kw));

      if (sportsPlayKeywords.some(kw => titleLower.includes(kw)) || hasVsPattern || hasRoundPattern || isOfficialSportsChannel) {
        return NextResponse.json(
          { error: '단순 스포츠 중계/풀매치/하이라이트 영상은 분석 대상이 아닙니다.\n스포츠 분석·전술 해설·리뷰 영상은 정상 분석됩니다.' },
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

    // 6. 해외 영상 필터링 (일본어 가나 문자 감지)
    const hasJapaneseKana = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(videoInfo.title || '') || 
                            /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(videoInfo.channelName || '');
    if (hasJapaneseKana) {
      return NextResponse.json(
        { error: '해외 영상(일본어 등)은 분석 대상이 아닙니다.\n한국어로 제작된 콘텐츠만 분석 가능합니다.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 7. 한글 미포함 필터링 (영어 전용 등)
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(videoInfo.title || '') || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(videoInfo.channelName || '');
    if (!hasKorean) {
      return NextResponse.json(
        { error: '한글이 포함되지 않은 영상은 분석 대상이 아닙니다.' },
        { status: 422, headers: corsHeaders }
      );
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

    // 자막 없는 영상은 분석 대상에서 제외
    if (!hasTranscript) {
      const err: any = new Error('자막이 없는 영상은 분석할 수 없습니다. 자막이 있는 영상만 분석 가능합니다.');
      err.statusCode = 422;
      throw err;
    }

    if (isRecheck && !hasTranscript) {
      const err: any = new Error('자막을 가져오지 못해 재검수가 불가능합니다.');
      err.statusCode = 422;
      throw err;
    }

    // 4. Gemini AI 분석 (Speed + Full 병렬)
    console.log('AI 분석 시작...');
    const analysisId = uuidv4();
    const cleanChannelId = videoInfo.channelId?.trim();
    let speedResult: { subtitleSummary?: string; thumbnail_spoiler?: any[] } = {};
    let analysisResult;
    let isValidTarget = true;
    let needsReview = false;
    let reviewReason: string | null = null;

    try {
      const promptTranscript = hasTranscript ? transcript : `[자막 없음 - 제목만으로 분석]\n제목: ${videoInfo.title}`;
      console.log('AI에게 전달되는 자막 길이:', promptTranscript.length);

      const preStageClient = await pool.connect();
      try {
        await preStageClient.query('BEGIN');

        await preStageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_is_recheck BOOLEAN DEFAULT FALSE`);
        await preStageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_parent_analysis_id TEXT`);
        await preStageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_at TIMESTAMP`);
        await preStageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_published_at TIMESTAMP`);
        await preStageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_processing_stage TEXT DEFAULT 'completed'`);
        await preStageClient.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);

        await preStageClient.query(`
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
          cleanChannelId,
          videoInfo.channelName,
          videoInfo.channelThumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.subscriberCount,
          finalLanguage
        ]);

        await preStageClient.query(`
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
          cleanChannelId,
          videoInfo.title,
          videoInfo.description,
          videoInfo.publishedAt || null,
          videoInfo.thumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0
        ]);

        await preStageClient.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_transcript, f_summary, f_user_id,
            f_official_category_id, f_request_count, f_view_count, f_created_at, f_last_action_at,
            f_is_recheck, f_recheck_parent_analysis_id, f_recheck_at,
            f_is_latest, f_language, f_published_at,
            f_fact_spoiler, f_fact_timestamp, f_processing_stage
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, NULL, $8,
            $9, 1, $10, NOW(), NOW(),
            $11, $12, $13,
            TRUE, $14, $15,
            NULL, NULL, 'pending'
          )
          ON CONFLICT (f_id) DO UPDATE SET
            f_processing_stage = 'pending',
            f_last_action_at = NOW()
        `, [
          analysisId,
          url,
          videoId,
          videoInfo.title,
          cleanChannelId,
          videoInfo.thumbnailUrl,
          transcript.substring(0, 50000),
          userId || null,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0,
          Boolean(isRecheck),
          isRecheck ? recheckParentAnalysisId : null,
          isRecheck ? new Date() : null,
          finalLanguage,
          videoInfo.publishedAt || null,
        ]);

        await preStageClient.query('COMMIT');
      } catch (preStageError) {
        await preStageClient.query('ROLLBACK');
        throw preStageError;
      } finally {
        preStageClient.release();
      }

      const speedOutcome = await analyzeContentSpeed(
        videoInfo.channelName,
        videoInfo.title,
        promptTranscript,
        transcriptItems,
        userLanguage
      ).then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error })
      );

      const hasSpeedReady = speedOutcome.ok;

      if (speedOutcome.ok) {
        const speedAnalysis = speedOutcome.value;
        speedResult = {
          subtitleSummary: speedAnalysis?.subtitleSummary,
          thumbnail_spoiler: speedAnalysis?.thumbnail_spoiler,
        };
      } else {
        const speedStatus = Number((speedOutcome.error as any)?.status ?? (speedOutcome.error as any)?.statusCode);
        const speedMsg = String((speedOutcome.error as any)?.message || '').toLowerCase();
        const isSpeedQuotaError =
          speedStatus === 429 ||
          speedMsg.includes('429') ||
          speedMsg.includes('quota') ||
          speedMsg.includes('resource exhausted');

        if (isSpeedQuotaError) {
          console.warn('[Speed Track] 쿼터 제한으로 스킵 - Full Track로 계속 진행:', speedOutcome.error);
          speedResult = {};
        } else {
          console.warn('[Speed Track] 분석 실패 - Full Track로 계속 진행:', speedOutcome.error);
          speedResult = {};
        }
      }

      const stageClient = await pool.connect();
      try {
        await stageClient.query('BEGIN');

        await stageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_is_recheck BOOLEAN DEFAULT FALSE`);
        await stageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_parent_analysis_id TEXT`);
        await stageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_at TIMESTAMP`);
        await stageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_published_at TIMESTAMP`);
        await stageClient.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_processing_stage TEXT DEFAULT 'completed'`);
        await stageClient.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);

        await stageClient.query(`
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
          cleanChannelId,
          videoInfo.channelName,
          videoInfo.channelThumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.subscriberCount,
          finalLanguage
        ]);

        await stageClient.query(`
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
          cleanChannelId,
          videoInfo.title,
          videoInfo.description,
          videoInfo.publishedAt || null,
          videoInfo.thumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0
        ]);

        await stageClient.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_transcript, f_summary, f_user_id,
            f_official_category_id, f_request_count, f_view_count, f_created_at, f_last_action_at,
            f_is_recheck, f_recheck_parent_analysis_id, f_recheck_at,
            f_is_latest, f_language, f_published_at,
            f_fact_spoiler, f_fact_timestamp, f_processing_stage
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, 1, $11, NOW(), NOW(),
            $12, $13, $14,
            TRUE, $15, $16,
            $17, NULL, $18
          )
          ON CONFLICT (f_id) DO UPDATE SET
            f_summary = EXCLUDED.f_summary,
            f_fact_spoiler = EXCLUDED.f_fact_spoiler,
            f_processing_stage = EXCLUDED.f_processing_stage,
            f_last_action_at = NOW()
        `, [
          analysisId,
          url,
          videoId,
          videoInfo.title,
          cleanChannelId,
          videoInfo.thumbnailUrl,
          transcript.substring(0, 50000),
          speedResult.subtitleSummary || null,
          userId || null,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0,
          Boolean(isRecheck),
          isRecheck ? recheckParentAnalysisId : null,
          isRecheck ? new Date() : null,
          finalLanguage,
          videoInfo.publishedAt || null,
          Array.isArray(speedResult.thumbnail_spoiler) ? JSON.stringify(speedResult.thumbnail_spoiler) : null,
          hasSpeedReady ? 'speed_ready' : 'pending'
        ]);

        await stageClient.query('COMMIT');
      } catch (stageError) {
        await stageClient.query('ROLLBACK');
        throw stageError;
      } finally {
        stageClient.release();
      }

      const fullOutcome = await analyzeContent(
        videoInfo.channelName,
        videoInfo.title,
        promptTranscript,
        videoInfo.thumbnailUrl,
        videoInfo.duration,
        transcriptItems,
        videoInfo.publishedAt,
        userLanguage
      ).then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error })
      );

      if (!fullOutcome.ok) {
        throw fullOutcome.error;
      }

      const analysis = fullOutcome.value;

      // [V2.0] AI의 분석 대상 적합성 판단 처리
      isValidTarget = analysis.is_valid_target !== false; // 기본값 true
      needsReview = analysis.needs_admin_review === true;
      reviewReason = analysis.review_reason || analysis.notAnalyzableReason || null;

      analysisResult = {
        accuracy: analysis.accuracy,
        clickbait: analysis.clickbait,
        reliability: analysis.reliability,
        subtitleSummary: analysis.subtitleSummary,
        evaluationReason: analysis.evaluationReason,
        overallAssessment: analysis.overallAssessment,
        recommendedTitle: analysis.recommendedTitle,
        groundingUsed: analysis.groundingUsed,
        groundingQueries: analysis.groundingQueries,
        notAnalyzable: analysis.notAnalyzable,
        notAnalyzableReason: analysis.notAnalyzableReason,
        thumbnail_spoiler: analysis.thumbnail_spoiler,
        thumbnail_spoiler_ts: analysis.thumbnail_spoiler_ts,
      };

      if (typeof speedResult.subtitleSummary === 'string' && speedResult.subtitleSummary.trim().length > 0) {
        analysisResult.subtitleSummary = speedResult.subtitleSummary;
      }
      if (Array.isArray(speedResult.thumbnail_spoiler) && speedResult.thumbnail_spoiler.length > 0) {
        analysisResult.thumbnail_spoiler = speedResult.thumbnail_spoiler;
      }

      console.log('AI 분석 데이터 수신 성공');
    } catch (aiError) {
      console.error('AI 분석 엔진 에러:', aiError);

      const rawMessage = String((aiError as any)?.message || 'unknown error');
      const rawStatus = Number((aiError as any)?.status ?? (aiError as any)?.statusCode);
      const lower = rawMessage.toLowerCase();
      const isQuotaError =
        rawStatus === 429 ||
        rawMessage.includes('429') ||
        lower.includes('resource exhausted') ||
        lower.includes('quota');
      const isTimeoutError =
        rawStatus === 408 ||
        lower.includes('timeout') ||
        String((aiError as any)?.code || '').toUpperCase() === 'ETIMEDOUT';

      const wrapped: any = new Error(
        isQuotaError
          ? 'AI 요청이 일시적으로 몰려 분석이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
          : isTimeoutError
            ? 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
            : 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );

      wrapped.statusCode = isQuotaError ? 429 : (isTimeoutError ? 408 : 500);
      wrapped.cause = aiError;
      throw wrapped;
    }

    if (!isValidTarget) {
      console.log(`[AI Reject] 분석 부적합 판정: ${reviewReason}`);
      const invalidClient = await pool.connect();
      try {
        await invalidClient.query('BEGIN');
        await invalidClient.query(`
          UPDATE t_analyses
          SET f_is_valid = FALSE,
              f_needs_review = $2,
              f_review_reason = $3,
              f_processing_stage = 'completed',
              f_last_action_at = NOW()
          WHERE f_id = $1
        `, [analysisId, needsReview, reviewReason]);
        await invalidClient.query('COMMIT');
      } catch (invalidErr) {
        await invalidClient.query('ROLLBACK');
        console.error('[AI Reject] DB 저장 실패:', invalidErr);
      } finally {
        invalidClient.release();
      }

      return NextResponse.json(
        {
          error: `분석 부적합 콘텐츠: ${reviewReason}`,
          notAnalyzable: true,
          reason: reviewReason,
          analysisId,
        },
        { status: 422, headers: corsHeaders }
      );
    }
    
    // [notAnalyzable 판정] AI가 분석 가치 없는 영상으로 판정한 경우
    if (analysisResult?.notAnalyzable === true) {
      const reason = analysisResult.notAnalyzableReason || '분석 불가 콘텐츠';
      console.log(`[notAnalyzable] AI 판정: ${reason} - DB 저장 후 거절`);

      // DB에 저장 (재요청 시 캐시 응답을 위해)
      const naClient = await pool.connect();
      try {
        await naClient.query('BEGIN');
        await naClient.query(`
          UPDATE t_analyses
          SET f_not_analyzable = TRUE,
              f_not_analyzable_reason = $2,
              f_is_valid = FALSE,
              f_needs_review = $3,
              f_review_reason = $4,
              f_processing_stage = 'completed',
              f_last_action_at = NOW()
          WHERE f_id = $1
        `, [analysisId, reason, needsReview, reviewReason]);
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

    // 5. DB 2차 저장 (정밀 분석 결과 업데이트)
    console.log('DB 저장 시작 (ID:', analysisId, ')');
    const client = await pool.connect();
    
    let creditDeducted = false;

    try {
      await client.query('BEGIN');

      // REFACTORED_BY_MERLIN_HUB: t_users ALTER TABLE 제거 — 크레딧은 Hub wallet로 이관 예정

      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_is_recheck BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_parent_analysis_id TEXT`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_at TIMESTAMP`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_published_at TIMESTAMP`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_processing_stage TEXT DEFAULT 'completed'`);

      // REFACTORED_BY_MERLIN_HUB: t_users 유저 생성/조회 제거 — Hub가 유저 관리
      // userId는 클라이언트에서 전달받은 family_uid를 그대로 사용
      let actualUserId = userId || null;

      // 5-1. 채널 정보 저장 (v2.0 필드 반영)
      console.log('5-1. 채널 정보 저장 (t_channels)...');
      await client.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);
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
        cleanChannelId, 
        videoInfo.channelName, 
        videoInfo.channelThumbnailUrl, 
        videoInfo.officialCategoryId,
        videoInfo.subscriberCount,
        finalLanguage
      ]);

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
        cleanChannelId,
        videoInfo.title,
        videoInfo.description,
        videoInfo.publishedAt || null,
        videoInfo.thumbnailUrl,
        videoInfo.officialCategoryId,
        videoInfo.viewCount || 0
      ]);

      if (!shouldKeepParentOnDecrease) {
        console.log('5-2. 분석 결과 저장 (t_analyses)...');
        
        // [v2.2 Optimization] Mark previous records as not latest
        await client.query(`
          UPDATE t_analyses 
          SET f_is_latest = FALSE 
          WHERE f_video_id = $1 AND f_id <> $2
        `, [videoId, analysisId]);

        // 5-2. 분석 결과 2차 업데이트 (v2.0 필드 반영) - f_topic 제거
        await client.query(`
          UPDATE t_analyses
          SET f_video_url = $2,
              f_video_id = $3,
              f_title = $4,
              f_channel_id = $5,
              f_thumbnail_url = $6,
              f_transcript = $7,
              f_accuracy_score = $8,
              f_clickbait_score = $9,
              f_reliability_score = $10,
              f_summary = $11,
              f_evaluation_reason = $12,
              f_overall_assessment = $13,
              f_ai_title_recommendation = $14,
              f_user_id = $15,
              f_official_category_id = $16,
              f_view_count = $23,
              f_last_action_at = NOW(),
              f_is_recheck = $17,
              f_recheck_parent_analysis_id = $18,
              f_recheck_at = $19,
              f_is_latest = TRUE,
              f_language = $20,
              f_grounding_used = $21,
              f_grounding_queries = $22,
              f_published_at = $24,
              f_is_valid = $25,
              f_needs_review = $26,
              f_review_reason = $27,
              f_fact_spoiler = $28,
              f_fact_timestamp = $29,
              f_processing_stage = 'completed'
          WHERE f_id = $1
        `, [
          analysisId,
          url,
          videoId,
          videoInfo.title,
          cleanChannelId,
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
          videoInfo.viewCount || 0,
          videoInfo.publishedAt || null,
          isValidTarget,
          needsReview,
          reviewReason,
          Array.isArray(analysisResult.thumbnail_spoiler) ? JSON.stringify(analysisResult.thumbnail_spoiler) : (analysisResult.thumbnail_spoiler || null),
          null
        ]);

        // [v3.3] t_videos 로직 제거 - t_analyses와 t_channel_stats만 사용
      } else {
        await client.query(`
          UPDATE t_analyses
          SET f_is_latest = FALSE,
              f_processing_stage = 'completed',
              f_last_action_at = NOW()
          WHERE f_id = $1
        `, [analysisId]);
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
            AND a.f_is_valid = TRUE
            AND a.f_needs_review = FALSE
          GROUP BY a.f_channel_id, a.f_official_category_id, COALESCE(a.f_language, 'korean')
          ON CONFLICT (f_channel_id, f_official_category_id, f_language) 
          DO UPDATE SET 
            f_video_count = EXCLUDED.f_video_count,
            f_avg_accuracy = EXCLUDED.f_avg_accuracy,
            f_avg_clickbait = EXCLUDED.f_avg_clickbait,
            f_avg_reliability = EXCLUDED.f_avg_reliability,
            f_last_updated = NOW()
        `, [cleanChannelId, videoInfo.officialCategoryId, finalLanguage]);
      }

      if (isRecheck) {
        if (!actualUserId) {
          throw new Error('로그인이 필요합니다.');
        }
        // REFACTORED_BY_MERLIN_HUB: t_users recheck 크레딧 → Hub wallet 이관 예정
        await ensureCreditHistoryTable(client);
        const currentBalance = await getLatestCreditBalance(client, actualUserId);
        if (!Number.isFinite(currentBalance) || currentBalance < 1) {
          const err: any = new Error('크레딧이 부족합니다.');
          err.statusCode = 402;
          throw err;
        }

        await appendCreditHistory(client, {
          userId: actualUserId,
          amount: -1,
          description: '영상 재분석',
          type: 'analysis',
        });

        creditDeducted = true;
      }

      // ── 일반 크레딧 차감 + 타임패스(ad_free_until) 갱신 ──
      // REFACTORED_BY_MERLIN_HUB: t_users 크레딧 차감 → Hub wallet 이관 예정
      if (!isRecheck && actualUserId && !actualUserId.startsWith('anon_') && !actualUserId.startsWith('trial_')) {
        await ensureCreditHistoryTable(client);
        const currentBalance = await getLatestCreditBalance(client, actualUserId);
        if (!Number.isFinite(currentBalance) || currentBalance < 30) {
          const err: any = new Error('크레딧이 부족합니다. 충전 후 다시 시도해주세요.');
          err.statusCode = 402;
          throw err;
        }

        const newBalance = await appendCreditHistory(client, {
          userId: actualUserId,
          amount: -30,
          description: '영상 분석',
          type: 'analysis',
        });

        creditDeducted = true;
        console.log(`[Credit] userId=${actualUserId}, -30C → balance=${newBalance}`);
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
          [actualUserId, cleanChannelId]
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
