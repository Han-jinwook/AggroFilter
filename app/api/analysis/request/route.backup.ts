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

// CORS ?¤ë” (?¬ë¡¬ ?•ì¥?????¸ë? origin ?ˆìš©)
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
    if (clickbait <= 20) return '?¼ì¹˜/ë§ˆì?????;
    if (clickbait <= 40) return 'ê³¼ì¥(?¤í•´/?œê°„???¼í•´/?šì„ ?˜ì?)';
    if (clickbait <= 60) return '?œê³¡(?¼ë?/ì§œì¦)';
    return '?ˆìœ„/ì¡°ì‘(?¤ì§ˆ ?ì‹¤ ê°€??';
  })();

  if (Number.isFinite(accuracy)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(?´ìš©\s*?•í™•??s*ê²€ì¦?s*)\(\s*\d+\s*??s*\)/g,
      `$1(${Math.round(accuracy)}??`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(1\.\s*?´ìš©\s*?•í™•??s*ê²€ì¦?(:)/,
        `$1 (${Math.round(accuracy)}??$2`
      );
    } else {
      out = replaced;
    }
  }

  if (Number.isFinite(clickbait)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(?´ê·¸ë¡œì„±\s*?‰ê?\s*)\(\s*\d+\s*??s*\)/g,
      `$1(${Math.round(clickbait)}??{clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(2\.\s*?´ê·¸ë¡œì„±\s*?‰ê?)(:)/,
        `$1 (${Math.round(clickbait)}??{clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})$2`
      );
    } else {
      out = replaced;
    }

    if (clickbaitTierLabel && !/2\.\s*?´ê·¸ë¡œì„±\s*?‰ê?[\s\S]*?<br\s*\/>\s*??s*?ìˆ˜??g.test(out)) {
      out = out.replace(
        /(2\.\s*?´ê·¸ë¡œì„±\s*?‰ê?[^<]*<br\s*\/>)/,
        `$1???ìˆ˜??'${clickbaitTierLabel}' êµ¬ê°„?…ë‹ˆ?? `
      );
    }
  }

  if (Number.isFinite(trust)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(? ë¢°??s*ì´í‰\s*)\(\s*\d+\s*??g,
      `$1(${Math.round(trust)}??
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(3\.\s*? ë¢°??s*ì´í‰)(:)/,
        `$1 (${Math.round(trust)}??$2`
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

    // ?¬ìš©??ë¸Œë¼?°ì? ?¸ì–´ ê°ì? (Accept-Language ?¤ë”)
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

    console.log('ë¶„ì„ ?”ì²­ URL:', url);

    // 1. YouTube ?ìƒ ID ì¶”ì¶œ
    const videoId = extractVideoId(url)?.trim();
    if (!videoId) {
      return NextResponse.json({ error: '? íš¨??YouTube URL???„ë‹™?ˆë‹¤.' }, { status: 400, headers: corsHeaders });
    }

    console.log('?ìƒ ID:', videoId);

    if (isRecheck) {
      if (!userId || userId.startsWith('anon_')) {
        return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??' }, { status: 401, headers: corsHeaders });
      }

      // REFACTORED_BY_MERLIN_HUB: t_users ?¬ë ˆ????Hub wallet ?´ê? ?ˆì •
      const creditClient = await pool.connect();
      try {
        await ensureCreditHistoryTable(creditClient);
        const credits = await getLatestCreditBalance(creditClient, userId);
        if (!Number.isFinite(credits) || credits <= 0) {
          return NextResponse.json({ error: '?¬ë ˆ?§ì´ ë¶€ì¡±í•©?ˆë‹¤.' }, { status: 402, headers: corsHeaders });
        }
      } finally {
        creditClient.release();
      }
    }

      // ?€?€ ?™ì‹œ ?”ì²­ ì¤‘ë³µ ë¶„ì„ ë°©ì? (Advisory Lock) ?€?€
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

          // [notAnalyzable ìºì‹œ] ?´ì „??AIê°€ ë¶„ì„ ë¶ˆê? ?ì •???ìƒ -> ì¦‰ì‹œ ë©”ì‹œì§€ ë°˜í™˜
          if (!forceRecheck && row.f_not_analyzable === true) {
            const cachedReason = row.f_not_analyzable_reason || 'ë¶„ì„ ë¶ˆê? ì½˜í…ì¸?;
            console.log(`[notAnalyzable ìºì‹œ] ?´ë? ?ì •???ìƒ: ${cachedReason}`);

            await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [videoId]);
            lockClient.release();
            lockClient = null;
            lockedVideoId = null;

            const reasonMessages: Record<string, string> = {
              '?¨ìˆœ ê²Œì„ ?Œë ˆ??: '?¨ìˆœ ê²Œì„ ?Œë ˆ???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\nê²Œì„ ë¦¬ë·°Â·?¼í‰Â·?´ì„¤ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
              '?¨ìˆœ ì°½ì‘ë¬??¬ìƒ': '?¨ìˆœ ì°½ì‘ë¬??¬ìƒ(?Œì•…Â·?ìƒ ?€?´ë†“ê¸? ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¼í‰Â·ë¹„í‰Â·ë¦¬ë·° ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
              '?˜ì´?¼ì´??ëª¨ìŒ': '?´ì„¤ ?†ëŠ” ?¨ìˆœ ?˜ì´?¼ì´??ëª¨ìŒ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¤í¬ì¸?ë¶„ì„Â·?„ìˆ  ?´ì„¤ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
              'ë°œí™” ?†ìŒ': 'ë¶„ì„???„ìš”???´ëŸ¬?´ì…˜Â·?¼í‰???†ëŠ” ?ìƒ?…ë‹ˆ??\n?¤ì§ˆ?ì¸ ? íƒê³??¼í‰???ˆëŠ” ?ìƒ???…ë ¥??ì£¼ì„¸??',
            };
            const userMessage = reasonMessages[cachedReason] || `???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤. (${cachedReason})`;

            return NextResponse.json(
              { error: userMessage, notAnalyzable: true, reason: cachedReason, cached: true },
              { status: 422, headers: corsHeaders }
            );
          }

          if (!forceRecheck && row.f_reliability_score !== null && row.f_reliability_score > 0) {
            console.log('?´ë? ë¶„ì„???ìƒ?…ë‹ˆ?? ê¸°ì¡´ ê²°ê³¼ ë°˜í™˜:', row.f_id);

            // ?€?€ ìºì‹œ ?ˆíŠ¸?ë„ ?¬ë ˆ??ì°¨ê° (? ë£Œ ì½˜í…ì¸??´ëŒ Paywall) ?€?€
            // REFACTORED_BY_MERLIN_HUB: t_users ?¬ë ˆ??ì°¨ê° ??Hub wallet ?´ê? ?ˆì •
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
                  { error: '?¬ë ˆ?§ì´ ë¶€ì¡±í•©?ˆë‹¤. ì¶©ì „ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.', insufficientCredits: true, redirectUrl: '/payment/mock' },
                  { status: 402, headers: corsHeaders }
                );
              }

              const newBalance = await appendCreditHistory(lockClient, {
                userId,
                amount: -30,
                description: '?ìƒ ë¶„ì„ (ìºì‹œ)',
                type: 'analysis',
              });
              cachedCreditDeducted = true;
              console.log(`[CreditÂ·Cache] userId=${userId}, -30C ??balance=${newBalance}`);
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
              message: '?´ë? ë¶„ì„???ìƒ?…ë‹ˆ??',
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

    // ?€?€ ?¬ë ˆ???”ì•¡ ì²´í¬ (??ë¶„ì„ ?œì—ë§? ìºì‹œ ?ˆíŠ¸??ë¬´ë£Œ) ?€?€
    if (!isRecheck && userId && !userId.startsWith('anon_')) {
      const creditCheckClient = await pool.connect();
      try {
        // REFACTORED_BY_MERLIN_HUB: t_users ?¬ë ˆ??ì¡°íšŒ ??Hub wallet ?´ê? ?ˆì •
        await ensureCreditHistoryTable(creditCheckClient);
        const userCredits = await getLatestCreditBalance(creditCheckClient, userId);
        if (!Number.isFinite(userCredits) || userCredits < 30) {
          return NextResponse.json(
            { error: '?¬ë ˆ?§ì´ ë¶€ì¡±í•©?ˆë‹¤. ì¶©ì „ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.', insufficientCredits: true, redirectUrl: '/payment/mock' },
            { status: 402, headers: corsHeaders }
          );
        }
      } finally {
        creditCheckClient.release();
      }
    }

    // 2. YouTube APIë¡??ìƒ ?•ë³´ ê°€?¸ì˜¤ê¸?
    const videoInfo = await getVideoInfo(videoId);
    console.log('?ìƒ ?•ë³´:', videoInfo.title);

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
              { error: '?¸ë„¤???œëª© ?˜ì •???†ì–´ ?¬ì‹¬???????†ìŠµ?ˆë‹¤.' },
              { status: 409, headers: corsHeaders }
            );
          }
        }
      } finally {
        gateClient.release();
      }
    }

    // 3. ?ë§‰ ì¶”ì¶œ (?´ë¼?´ì–¸?¸ì—??ë³´ë‚¸ ?ë§‰???ˆìœ¼ë©??°ì„  ?¬ìš©)
    let transcript = '';
    let transcriptItems: { text: string; start: number; duration: number }[] = [];
    let hasTranscript = false;

    // [Filter] ?…êµ¬ì»? ë¶„ì„ ê°€ì¹˜ê? ?†ëŠ” ?ìƒ ? í˜•??ì¦‰ì‹œ ì°¨ë‹¨ (ë¹„ìš© ?ˆê°)
    const titleLower = (videoInfo.title || '').toLowerCase();

    // 0. ì¹´í…Œê³ ë¦¬ ?”ì´?¸ë¦¬?¤íŠ¸ ê¸°ë°˜ ì¦‰ì‹œ ì°¨ë‹¨ (AI ë¶„ì„ ?´ì „ ??ë¹„ìš© ?ˆê° ë°?ë¹ ë¥¸ ê±°ì ˆ)
    // AutoMarketer?€ ?™ì¼???µì‹¬ 7ê°?ì¹´í…Œê³ ë¦¬ë§??ˆìš©: 22,24,25,26,27,28,29
    const officialCategoryId = videoInfo.officialCategoryId?.toString();
    const allowedCategoryIds = new Set(['22', '24', '25', '26', '27', '28', '29']);
    const blockedCategoryMessages: Record<string, string> = {
      '10': '?Œì•…(M/V, ?Œì›) ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?Œì•… ?‰ë¡ Â·ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '1': '?í™”/? ë‹ˆë©”ì´???¬ìƒ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?í™” ë¦¬ë·°Â·ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '2': '?ë™ì°??´ë™?˜ë‹¨ ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?ë™ì°?ë¦¬ë·°Â·ë¹„êµ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '15': 'ë°˜ë ¤?™ë¬¼/?™ë¬¼ ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.',
      '17': '?¤í¬ì¸??¨ìˆœ ê²½ê¸°/?˜ì´?¼ì´???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¤í¬ì¸?ë¶„ì„Â·?„ìˆ  ?´ì„¤ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '19': '?¬í–‰/?´ë²¤??ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¬í–‰ ?•ë³´Â·ë¦¬ë·° ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '20': 'ê²Œì„ ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\nê²Œì„ ë¦¬ë·°Â·?¼í‰Â·ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
      '23': 'ì½”ë???? ë¨¸ ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.',
      '43': 'ë°©ì†¡(Shows) ì¹´í…Œê³ ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.',
    };
    if (!officialCategoryId || !allowedCategoryIds.has(officialCategoryId)) {
      const msg = blockedCategoryMessages[officialCategoryId || ''] ||
        '?„ì¬ ë¶„ì„ ê°€?¥í•œ ì¹´í…Œê³ ë¦¬ê°€ ?„ë‹™?ˆë‹¤.\n(?ˆìš© ì¹´í…Œê³ ë¦¬: ?¸ë¬¼/ë¸”ë¡œê·? ?”í„°?Œì¸ë¨¼íŠ¸, ?´ìŠ¤/?•ì¹˜, ?¸í•˜???¤í??? êµìœ¡, ê³¼í•™/ê¸°ìˆ , ë¹„ì˜ë¦??¬íšŒ)';
      return NextResponse.json({ error: msg }, { status: 422, headers: corsHeaders });
    }

    // 1. ?¨ìˆœ ?Œì•… ?ìƒ (MV, Official Video ?? ??ì¹´í…Œê³ ë¦¬ ë¬´ê? ?¤ì›Œ??ì°¨ë‹¨
    const musicKeywords = [
      ' m/v', '(m/v)', '[m/v]',
      ' mv)', '(mv)', '[mv]',
      '[mv]', '(mv)', ' mv ',
      'official video', 'official m/v', 'official mv',
      'lyric video', 'lyrics video',
      'music video',
      'official audio',
      'ë®¤ì§ë¹„ë””??,
      '?¸ë˜ ê°€??,
      'ê°€???ìƒ',
      'special clip', 'live clip',
      'ä¸»é¡Œæ­?, '?¿å…¥æ­?, // ?¼ë³¸??ì£¼ì œê°€, ?½ì…ê³?
      'utattemita', 'æ­Œã£?¦ã¿??, // ë¶ˆëŸ¬ë³´ì•˜??(ì»¤ë²„)
      'å¼¾ã„?¦ã¿??, // ?°ì£¼?´ë³´?˜ë‹¤
      'dance practice', '?ˆë¬´ ?ìƒ',
      'lyrics', 'ê°€??, 'karaoke', '(inst)', '[inst]', 'instrumental',
      'remix', 'prod by', ' feat.', ' ft.',
      '?ë§‰??,
    ];
    if (musicKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '?¨ìˆœ ?Œì•… ?ìƒ(M/V, Official Video ???€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?Œì•… ?‰ë¡ Â·?¸í„°ë·°Â·ì—°ì£??ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 2. ?¼ì´ë¸??ë°©???˜ì´?¼ì´??(?¨ìˆœ ?¬ìƒ ?ìƒ)
    const liveKeywords = [
      '?¼ì´ë¸?, '?ë°©??, '?ì¤‘ê³?, '?¤ì‹œê°?ë°©ì†¡',
      ' live', '(live)', '[live]',
      'live stream', 'livestream', 'streaming', 'streamer', '?¤íŠ¸ë¦¬ë°', '?¤íŠ¸ë¦¬ë¨¸',
      '?¤ì‹œë³´ê¸°', '?€?ìƒ', '?„í¸', '?¹í™”ë³?, 'ë°©ì†¡ë¶?, '(??',
      'ë¬´ë??ìƒ', 'ê³µì—°?ìƒ', 'ì½˜ì„œ??, 'fancam', 'ì§ìº ',
      '?˜ì´?¼ì´??, '?€ ?˜ì´?¼ì´??, 'highlight', 'highlights',
      ' h/l', '[h/l]', '(h/l)', ' hl ', '[hl]', '(hl)',
      '?ì ?¥ë©´', 'ê³¨ì¥ë©?, 'ëª…ì¥ë©?, 'ì£¼ìš”?¥ë©´', '?„ë°˜??, '?„ë°˜??,
      'ëª¨ë“  ê³?, '?„ê²½ê¸?, 'ê²½ê¸° ?”ì•½',
      '?•ì£¼??, '?°ì†ë³´ê¸°', 'ëª¨ìŒì§?, 'ëª¨ìŒ', '?´ë¦½', 'clips',
      '?¤ì‹œê°?, 'ë°©ì†¡ì¤?, '?¬ë¦½?œë‹¤', '?ë°©',
      '???ê¸?, 'ìµœì‹ ??, 'ë©¸ë§??, '?€??, '?¤í¬ë¦?, '?´ì „', '?ë­',
    ];
    if (liveKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '?¼ì´ë¸ŒÂ·ìƒë°©ì†¡Â·?˜ì´?¼ì´???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¸ì§‘??ë¦¬ë·°Â·?¼í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 3. ?¨ìˆœ ì¤„ê±°ë¦??”ì•½/ê²°ë§ (?¼í‰ ?†ì´ ?´ìš©ë§??•ì¶•)
    const summaryKeywords = [
      'ì¤„ê±°ë¦??”ì•½', '?´ìš© ?”ì•½', 'ì¤„ê±°ë¦??•ë¦¬',
      'ê²°ë§ ?•ë¦¬', 'ê²°ë§ ?”ì•½', 'ê²°ë§ ?¬í•¨',
      '?¤í† ë¦??”ì•½', '?´ìš© ?•ë¦¬', '???”ì•½',
      'ëª°ì•„ë³´ê¸°', '?„ì²´ ì¤„ê±°ë¦?,
    ];
    if (summaryKeywords.some(kw => titleLower.includes(kw))) {
      return NextResponse.json(
        { error: '?¨ìˆœ ì¤„ê±°ë¦??”ì•½Â·ê²°ë§ ?•ë¦¬ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?í™”Â·?œë¼ë§??¼í‰Â·ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 4. ?¨ìˆœ ì½˜í…ì¸??¬ìƒ (ì¹´í…Œê³ ë¦¬ + ?¤ì›Œ??ì¡°í•©, ?¼í‰/ë¦¬ë·° ?¤ì›Œ???ˆìœ¼ë©??µê³¼)
    const reviewKeywords = [
      'ë¦¬ë·°', 'ë¶„ì„', 'ë¹„íŒ', '?¼ë?', 'ë¬¸ì œ', '?‰ê?',
      'ì¶”ì²œ', 'ë¹„êµ', 'ìµœê³ ', 'ìµœì•…', '??‚¹',
      '?´ì„¤', '?¼í‰', '?˜ë?', '?œì‚¬',
    ];
    const hasReviewKw = reviewKeywords.some(kw => titleLower.includes(kw));

    // ê²Œì„(20): ?¨ìˆœ ?Œë ˆ??
    if (officialCategoryId === '20' && !hasReviewKw) {
      const gamePlayKeywords = [
        '?Œë ˆ??, 'gameplay', 'game play',
        '?€ê²Œì„', '?€?Œë ˆ??,
        '?”ë¡œ??¬', '?”ë­', 'ì¹¼ë°”??, 'ë°°í?ê·¸ë¼?´ë“œ',
        '?´ë¦¬??, '?”ë”©', 'ê³µëµ',
        '?¡ì„±', 'ê°•í™”', '?¬ì‰¬', '?¸ê???, '?Œë°',
        'ë¦¬ë‹ˆì§€', 'ë¦¬ë‹ˆì§€m', 'ë¦¬ë‹ˆì§€w', 'ë¦¬ë‹ˆì§€2m', 'ë¦¬ë‹ˆì§€?´ë˜??,
        'ë©”ì´??, 'ë©”ì´?ŒìŠ¤? ë¦¬', 'ë¡œì•„', 'ë¡œìŠ¤?¸ì•„??, '?˜íŒŒ', '?˜ì „?¤íŒŒ?´í„°',
        'ë¡?, 'league of legends', 'lol', 'tft', '?„ëµ???€ ?„íˆ¬',
        'ë°°ê·¸', 'pubg', 'ë°œë¡œ?€??, 'valorant',
        '?¤ë²„?Œì¹˜', 'overwatch', 'minecraft', 'ë§ˆì¸?¬ë˜?„íŠ¸',
        '?°ì–´?¬ë¦¬ê¸?,
        '?”ë“¤', 'ê±°ì¸ ?”ë“¤', '2ì¤??±ì¥', 'ë½‘ê¸°', 'ì§€ë°°ë½‘ê¸?,
        '?œë“ ?´íƒ', '?œë“ ', 'sudden attack', 'ì² ê¶Œ', 'tekken',
        '?¼íŒŒ', 'fc?¨ë¼??, 'fconline', '?¤í?', '?¤í??¬ë˜?„íŠ¸',
        'ê¸°ê? ë§‰íŒ ?€?´ë°', '?€?´ë°',
        '?ì¡´ ?œë‹¨', '?¼ì…', '?‘ë¡­ë²•ì‚¬',
      ];
      if (gamePlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '?¨ìˆœ ê²Œì„ ?Œë ˆ???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\nê²Œì„ ë¦¬ë·°Â·?¼í‰Â·ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // ?¤í¬ì¸?17): ?¨ìˆœ ê²½ê¸° ì¤‘ê³„/?€ë§¤ì¹˜/?¨í„´ ê¸°ë°˜ ?˜ì´?¼ì´??
    if (officialCategoryId === '17' && !hasReviewKw) {
      const sportsPlayKeywords = [
        '?€ê²Œì„', '?€ë§¤ì¹˜', '?„ë¦¬??, '?¤ì œê²½ê¸°',
        'full match', 'full game',
        'ì¤‘ê³„', 'ì§ìº?¤íŠ¸', '?¼ì´ë¸?ì¤‘ê³„',
        '?¼ìš´??, ' round', ' r ',
      ];
      // [v3.5] ?€ vs ?€ ?•íƒœ???¨ìˆœ ê²½ê¸° ?ìƒ ì°¨ë‹¨ (ë¦¬ë·° ?¤ì›Œ???†ì„ ??
      const hasVsPattern = titleLower.includes(' vs ') || titleLower.includes(' vs. ') || titleLower.includes(' v ');
      const hasRoundPattern = /\d+r\s/.test(titleLower) || /\d+?¼ìš´??.test(titleLower);

      // ê³µì‹ ì±„ë„???´ë¦„ ê°ì?
      const channelName = (videoInfo.channelName || '').toLowerCase();
      const isOfficialSportsChannel = [
        'ì¿ íŒ¡?Œë ˆ??, 'coupang play', 'sbs', 'kbs', 'mbc', 'tvn', 'jtbc', 'spotv', '?¤í¬?°ë¹„',
        'kë¦¬ê·¸', 'kleague', 'kfa', 'ì¶•êµ¬?‘íšŒ', 'kbo', 'kbl', 'kovo', 'vë¦¬ê·¸', 'v-league',
        'ê³µì‹ì±„ë„', 'official', 'sports', '?¤í¬ì¸?, 'tvì¡°ì„ ', 'ì±„ë„a', 'mbn'
      ].some(kw => channelName.includes(kw));

      if (sportsPlayKeywords.some(kw => titleLower.includes(kw)) || hasVsPattern || hasRoundPattern || isOfficialSportsChannel) {
        return NextResponse.json(
          { error: '?¨ìˆœ ?¤í¬ì¸?ì¤‘ê³„/?€ë§¤ì¹˜/?˜ì´?¼ì´???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¤í¬ì¸?ë¶„ì„Â·?„ìˆ  ?´ì„¤Â·ë¦¬ë·° ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // ?„ë¦„/? ë‹ˆ(1): ?¨ìˆœ ?í™”/?œë¼ë§??¬ìƒ
    if (officialCategoryId === '1' && !hasReviewKw) {
      const filmPlayKeywords = [
        '?„í¸ ë³´ê¸°', '?€ë²„ì „', '?„í¸ ?¤íŠ¸ë¦?,
        'full movie', 'full film', 'full episode',
        '?„í¸ë³´ê¸°', '?„ì²´ ë³´ê¸°',
      ];
      if (filmPlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '?¨ìˆœ ?í™”/?œë¼ë§??¬ìƒ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?í™”Â·?œë¼ë§??¼í‰Â·ë¹„í‰Â·ë¦¬ë·° ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // ?”í„°?Œì¸ë¨¼íŠ¸(24): ê³µì—°/ì½˜ì„œ???¨ìˆœ ?¬ìƒ
    if (officialCategoryId === '24' && !hasReviewKw) {
      const entertainPlayKeywords = [
        'ì½˜ì„œ???ìƒ', 'ì½˜ì„œ???„í¸', '?„ì²´ ê³µì—°',
        'full concert', 'full performance', 'full show',
        'ê³µì—° ?ìƒ', 'ê³µì—° ?„í¸',
      ];
      if (entertainPlayKeywords.some(kw => titleLower.includes(kw))) {
        return NextResponse.json(
          { error: '?¨ìˆœ ê³µì—°/ì½˜ì„œ???¬ìƒ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\nì½˜ì„œ??ë¦¬ë·°Â·ê³µì—° ë¹„í‰ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??' },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // 6. ?´ì™¸ ?ìƒ ?„í„°ë§?(?¼ë³¸??ê°€??ë¬¸ì ê°ì?)
    const hasJapaneseKana = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(videoInfo.title || '') || 
                            /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(videoInfo.channelName || '');
    if (hasJapaneseKana) {
      return NextResponse.json(
        { error: '?´ì™¸ ?ìƒ(?¼ë³¸?????€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?œêµ­?´ë¡œ ?œì‘??ì½˜í…ì¸ ë§Œ ë¶„ì„ ê°€?¥í•©?ˆë‹¤.' },
        { status: 422, headers: corsHeaders }
      );
    }

    // 7. ?œê? ë¯¸í¬???„í„°ë§?(?ì–´ ?„ìš© ??
    const hasKorean = /[????????ê°€-??/.test(videoInfo.title || '') || /[????????ê°€-??/.test(videoInfo.channelName || '');
    if (!hasKorean) {
      return NextResponse.json(
        { error: '?œê????¬í•¨?˜ì? ?Šì? ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.' },
        { status: 422, headers: corsHeaders }
      );
    }

    if (clientTranscript && typeof clientTranscript === 'string' && clientTranscript.length > 50) {
      // ?¬ë¡¬ ?•ì¥??ëª¨ë°”???±ì—??ë³´ë‚¸ ?ë§‰ ?¬ìš©
      transcript = clientTranscript;
      transcriptItems = Array.isArray(clientTranscriptItems) ? clientTranscriptItems : [];
      hasTranscript = true;
      console.log(`?´ë¼?´ì–¸???ë§‰ ?¬ìš©: ${transcript.length}?? items: ${transcriptItems.length}`);
    } else {
      // ?œë²„?ì„œ ?ë§‰ ì¶”ì¶œ ?œë„ (1??
      try {
        const items = await getTranscriptItems(videoId);
        if (items.length > 0) {
          transcriptItems = items.map((it) => ({ text: it.text, start: it.offset, duration: it.duration }));
          transcript = items.map((it) => it.text).join(' ');
        }

        hasTranscript = transcript && transcript.length > 50 && !transcript.includes('ê°€?¸ì˜¬ ???†ìŠµ?ˆë‹¤');
        console.log('?ë§‰ ?íƒœ:', hasTranscript ? `?±ê³µ (${transcript.length}?? items: ${transcriptItems.length})` : '?ë§‰ ?†ìŒ');
      } catch (e) {
        console.error('?ë§‰ ì¶”ì¶œ ì¤??ëŸ¬:', e);
        hasTranscript = false;
      }
    }

    // [v2.0 Youtube Native Strategy]
    // AI ?¬ë¶„ë¥?Track A/B) ë¡œì§ ?„ë©´ ?ê¸°
    // ? íŠœë¸?APIê°€ ?œê³µ?˜ëŠ” category_idë¥??ˆë???ê¸°ì??¼ë¡œ ?¬ìš©
    const f_official_category_id = videoInfo.officialCategoryId;
    console.log(`[Youtube Native] Category ID: ${f_official_category_id}`);
    
    // [v3.1 Global Ranking] 3?¨ê³„ ?¸ì–´ ê°ì? Fallback
    let finalLanguage = videoInfo.language; // Step 1: YouTube API
    let languageSource = videoInfo.languageSource || 'unknown';
    
    // Step 2: ?ë§‰ ê¸°ë°˜ ?¸ì–´ ê°ì? (Plan B - ?µì‹¬ ë¬´ê¸°)
    if (!finalLanguage && hasTranscript && transcriptItems.length > 0) {
      const firstText = transcriptItems[0].text;
      finalLanguage = detectLanguageFromText(firstText);
      languageSource = 'transcript';
      console.log(`[Language Detection] Step 2 (Transcript): ${finalLanguage}`);
    }
    
    // Step 3: ê¸°ë³¸ê°?(Plan C)
    if (!finalLanguage) {
      finalLanguage = 'ko'; // ê¸°ë³¸ê°?
      languageSource = 'user';
      console.log(`[Language Detection] Step 3 (Default): ${finalLanguage}`);
    }
    
    console.log(`[Language Detection] Final: ${finalLanguage} (source: ${languageSource})`);
    
    // ?ë§‰ ê°€?¸ì˜¤ê¸??¤íŒ¨??ê³ ì?
    if (!hasTranscript) {
      transcript = '[?ë§‰ ê°€?¸ì˜¤ê¸??¤íŒ¨] ?ë§‰??ë¶ˆëŸ¬?¤ëŠ” ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.';
    }
    console.log('?ë§‰ ?¬ìš© ?¬ë?:', hasTranscript);

    // ?ë§‰ ?†ëŠ” ?ìƒ?€ ë¶„ì„ ?€?ì—???œì™¸
    if (!hasTranscript) {
      const err: any = new Error('?ë§‰???†ëŠ” ?ìƒ?€ ë¶„ì„?????†ìŠµ?ˆë‹¤. ?ë§‰???ˆëŠ” ?ìƒë§?ë¶„ì„ ê°€?¥í•©?ˆë‹¤.');
      err.statusCode = 422;
      throw err;
    }

    if (isRecheck && !hasTranscript) {
      const err: any = new Error('?ë§‰??ê°€?¸ì˜¤ì§€ ëª»í•´ ?¬ê??˜ê? ë¶ˆê??¥í•©?ˆë‹¤.');
      err.statusCode = 422;
      throw err;
    }

    // 4. Gemini AI ë¶„ì„
    console.log('AI ë¶„ì„ ?œì‘...');
    let analysisResult;
    let isValidTarget = true;
    let needsReview = false;
    let reviewReason: string | null = null;

    try {
      const promptTranscript = hasTranscript ? transcript : `[?ë§‰ ?†ìŒ - ?œëª©ë§Œìœ¼ë¡?ë¶„ì„]\n?œëª©: ${videoInfo.title}`;
      console.log('AI?ê²Œ ?„ë‹¬?˜ëŠ” ?ë§‰ ê¸¸ì´:', promptTranscript.length);
      
      const analysis = await analyzeContent(
        videoInfo.channelName,
        videoInfo.title,
        promptTranscript,
        videoInfo.thumbnailUrl,
        videoInfo.duration,
        transcriptItems,
        videoInfo.publishedAt,
        userLanguage
      );

      // [V2.0] AI??ë¶„ì„ ?€???í•©???ë‹¨ ì²˜ë¦¬
      isValidTarget = analysis.is_valid_target !== false; // ê¸°ë³¸ê°?true
      needsReview = analysis.needs_admin_review === true;
      reviewReason = analysis.review_reason || analysis.notAnalyzableReason || null;

      if (!isValidTarget) {
        console.log(`[AI Reject] ë¶„ì„ ë¶€?í•© ?ì •: ${reviewReason}`);
        // ë¶€?í•© ?ì • ??DB???€?¥í•˜?? f_is_valid = falseë¡?ë§ˆí‚¹?˜ì—¬ ?¸ì¶œ ?œì™¸
        // ?ëŠ” ê¸°ì¡´ì²˜ëŸ¼ 422 ?ëŸ¬ë¡?ë°˜í™˜ (?¬ìš©???”ì²­???°ë¼ ?€?????¨ê? ì²˜ë¦¬??ê°€??
        // ?¬ê¸°?œëŠ” ê¸°íš??v2.0???°ë¼ 'ë¶„ì„ ?°ì´???Œê¸°' ?ëŠ” 'ë¶„ì„ ë¶ˆê?' ë©”ì‹œì§€ ë°˜í™˜
        return NextResponse.json(
          { 
            error: `ë¶„ì„ ë¶€?í•© ì½˜í…ì¸? ${reviewReason}`, 
            notAnalyzable: true, 
            reason: reviewReason 
          },
          { status: 422, headers: corsHeaders }
        );
      }

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
      console.log('AI ë¶„ì„ ?°ì´???˜ì‹  ?±ê³µ');
    } catch (aiError) {
      console.error('AI ë¶„ì„ ?”ì§„ ?ëŸ¬:', aiError);
      throw new Error(`AI ë¶„ì„ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ${aiError.message}`);
    }
    
    // [notAnalyzable ?ì •] AIê°€ ë¶„ì„ ê°€ì¹??†ëŠ” ?ìƒ?¼ë¡œ ?ì •??ê²½ìš°
    if (analysisResult?.notAnalyzable === true) {
      const reason = analysisResult.notAnalyzableReason || 'ë¶„ì„ ë¶ˆê? ì½˜í…ì¸?;
      console.log(`[notAnalyzable] AI ?ì •: ${reason} - DB ?€????ê±°ì ˆ`);

      // DB???€??(?¬ìš”ì²???ìºì‹œ ?‘ë‹µ???„í•´)
      const naClient = await pool.connect();
      try {
        await naClient.query('BEGIN');
        
        const cleanChannelId = videoInfo.channelId?.trim();

        // t_channels ?€??(v2.0 ?„ë“œ ë°˜ì˜) - FK ?œì•½ ì¡°ê±´ ?„ë°˜ ë°©ì?ë¥??„í•´ ? í–‰
        await naClient.query(`
          INSERT INTO t_channels (
            f_channel_id, f_title, f_thumbnail_url, f_official_category_id, f_subscriber_count
          ) VALUES ($1, $2, NULLIF($3, ''), $4, $5)
          ON CONFLICT (f_channel_id) DO UPDATE SET
            f_title = COALESCE(NULLIF(EXCLUDED.f_title, ''), t_channels.f_title),
            f_thumbnail_url = COALESCE(EXCLUDED.f_thumbnail_url, t_channels.f_thumbnail_url),
            f_official_category_id = EXCLUDED.f_official_category_id,
            f_subscriber_count = EXCLUDED.f_subscriber_count
        `, [
          cleanChannelId,
          videoInfo.channelName,
          videoInfo.channelThumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.subscriberCount || 0
        ]);

        // t_videos ?€??(metadataë§?
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
          cleanChannelId,
          videoInfo.title,
          videoInfo.publishedAt || null,
          videoInfo.thumbnailUrl,
          videoInfo.officialCategoryId,
          videoInfo.viewCount || 0
        ]);

        // t_analyses??notAnalyzable ?ˆì½”???€??
        const insertRes = await naClient.query(
          `INSERT INTO t_analyses (
            f_video_url, f_video_id, f_title, f_channel_id, f_thumbnail_url,
            f_transcript, f_accuracy_score, f_clickbait_score, f_reliability_score,
            f_summary, f_evaluation_reason, f_overall_assessment, f_ai_title_recommendation,
            f_user_id, f_official_category_id, f_is_latest, f_language,
            f_grounding_used, f_grounding_queries, f_published_at,
            f_not_analyzable, f_not_analyzable_reason,
            f_is_valid, f_needs_review, f_review_reason
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
          ) RETURNING f_id`,
          [
            url, videoId, videoInfo.title, videoInfo.channelId, videoInfo.thumbnailUrl,
            transcript, analysisResult.accuracy, analysisResult.clickbait, analysisResult.reliability,
            analysisResult.subtitleSummary, analysisResult.evaluationReason, analysisResult.overallAssessment, analysisResult.recommendedTitle,
            userId || null, videoInfo.officialCategoryId, true, finalLanguage,
            analysisResult.groundingUsed || false, analysisResult.groundingQueries || [], videoInfo.publishedAt,
            analysisResult.notAnalyzable || false, reason,
            isValidTarget, needsReview, reviewReason
          ]
        );
      } catch (dbErr) {
        await naClient.query('ROLLBACK');
        console.error('[notAnalyzable] DB ?€???¤íŒ¨ (ë­”ì‹œ):', dbErr);
      } finally {
        naClient.release();
      }

      const reasonMessages: Record<string, string> = {
        '?¨ìˆœ ê²Œì„ ?Œë ˆ??: '?¨ìˆœ ê²Œì„ ?Œë ˆ???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\nê²Œì„ ë¦¬ë·°Â·?¼í‰Â·?´ì„¤ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
        '?¨ìˆœ ì°½ì‘ë¬??¬ìƒ': '?¨ìˆœ ì°½ì‘ë¬??¬ìƒ(?Œì•…Â·?ìƒ ?€?´ë†“ê¸? ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¼í‰Â·ë¹„í‰Â·ë¦¬ë·° ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
        '?˜ì´?¼ì´??ëª¨ìŒ': '?´ì„¤ ?†ëŠ” ?¨ìˆœ ?˜ì´?¼ì´??ëª¨ìŒ ?ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤.\n?¤í¬ì¸?ë¶„ì„Â·?„ìˆ  ?´ì„¤ ?ìƒ?€ ?•ìƒ ë¶„ì„?©ë‹ˆ??',
        'ë°œí™” ?†ìŒ': 'ë¶„ì„???„ìš”???´ëŸ¬?´ì…˜Â·?¼í‰???†ëŠ” ?ìƒ?…ë‹ˆ??\n?¤ì§ˆ?ì¸ ? íƒê³??¼í‰???ˆëŠ” ?ìƒ???…ë ¥??ì£¼ì„¸??',
      };
      const userMessage = reasonMessages[reason] || `???ìƒ?€ ë¶„ì„ ?€?ì´ ?„ë‹™?ˆë‹¤. (${reason})`;

      return NextResponse.json(
        { error: userMessage, notAnalyzable: true, reason },
        { status: 422, headers: corsHeaders }
      );
    }

    // ?ë§‰ ?†ëŠ” ?ìƒ: AIê°€ ?œëª©+?¬ë„¤?¼ë¡œ ë¶„ì„???ìˆ˜??? ì?, ?ë§‰ ?”ì•½ë§??œì‹œ ë³€ê²?
    if (!hasTranscript && !analysisResult.subtitleSummary?.includes('?ë§‰ ?†ìŒ')) {
      analysisResult.subtitleSummary = '?ë§‰ ?†ìŒ - ?œëª© ë°??¬ë„¤??ê¸°ë°˜ ë¶„ì„';
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
    console.log('AI ë¶„ì„ ?„ë£Œ:', analysisResult.reliability, hasTranscript ? '' : '(?ë§‰?†ìŒ-?œëª©/?¸ë„¤??ê¸°ë°˜)');

    const shouldKeepParentOnDecrease =
      Boolean(isRecheck) &&
      Boolean(recheckParentAnalysisId) &&
      typeof analysisResult?.reliability === 'number' &&
      typeof recheckParentTrust === 'number' &&
      analysisResult.reliability < recheckParentTrust;

    // 5. DB???€??
    const analysisId = uuidv4();
    console.log('DB ?€???œì‘ (ID:', analysisId, ')');
    const client = await pool.connect();
    
    let creditDeducted = false;

    try {
      await client.query('BEGIN');

      // REFACTORED_BY_MERLIN_HUB: t_users ALTER TABLE ?œê±° ???¬ë ˆ?§ì? Hub walletë¡??´ê? ?ˆì •

      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_is_recheck BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_parent_analysis_id TEXT`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_recheck_at TIMESTAMP`);
      await client.query(`ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_published_at TIMESTAMP`);

      // REFACTORED_BY_MERLIN_HUB: t_users ? ì? ?ì„±/ì¡°íšŒ ?œê±° ??Hubê°€ ? ì? ê´€ë¦?
      // userId???´ë¼?´ì–¸?¸ì—???„ë‹¬ë°›ì? family_uidë¥?ê·¸ë?ë¡??¬ìš©
      let actualUserId = userId || null;

      // 5-1. ì±„ë„ ?•ë³´ ?€??(v2.0 ?„ë“œ ë°˜ì˜)
      console.log('5-1. ì±„ë„ ?•ë³´ ?€??(t_channels)...');
      const cleanChannelId = videoInfo.channelId?.trim();
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

      console.log('5-1-1. ë¹„ë””??ê¸°ë³¸ ?•ë³´ ?€??(t_videos)...');
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
        console.log('5-2. ë¶„ì„ ê²°ê³¼ ?€??(t_analyses)...');
        
        // [v2.2 Optimization] Mark previous records as not latest
        await client.query(`
          UPDATE t_analyses 
          SET f_is_latest = FALSE 
          WHERE f_video_id = $1
        `, [videoId]);

        // 5-2. ë¶„ì„ ê²°ê³¼ ?€??(v2.0 ?„ë“œ ë°˜ì˜) - f_topic ?œê±°
        await client.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_transcript, f_accuracy_score, f_clickbait_score,
            f_reliability_score, f_summary, f_evaluation_reason, f_overall_assessment,
            f_ai_title_recommendation, f_user_id, f_official_category_id,
            f_request_count, f_view_count, f_created_at, f_last_action_at,
            f_is_recheck, f_recheck_parent_analysis_id, f_recheck_at,
            f_is_latest, f_language,
            f_grounding_used, f_grounding_queries,
            f_published_at,
            f_is_valid, f_needs_review, f_review_reason,
            f_fact_spoiler, f_fact_timestamp
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            1, $23, NOW(), NOW(),
            $17, $18, $19,
            TRUE, $20,
            $21, $22,
            $24,
            $25, $26, $27,
            $28, $29
          )
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

        // [v3.3] t_videos ë¡œì§ ?œê±° - t_analyses?€ t_channel_statsë§??¬ìš©
      }

      // 5-4. ì±„ë„ ?µê³„ ê°±ì‹  (ì¹´í…Œê³ ë¦¬ë³?+ ?¸ì–´ë³?
      console.log('5-4. ì±„ë„ ?µê³„ ê°±ì‹  ?œì‘ (?¸ì–´ë³?ë¶„ë¦¬)...');
      if (hasTranscript) {
        // [v3.0] ?¸ì–´ë³??µê³„ ë¶„ë¦¬: ì±„ë„+ì¹´í…Œê³ ë¦¬+?¸ì–´ 3ì°¨ì› ê´€ë¦?
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
          throw new Error('ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??');
        }
        // REFACTORED_BY_MERLIN_HUB: t_users recheck ?¬ë ˆ????Hub wallet ?´ê? ?ˆì •
        await ensureCreditHistoryTable(client);
        const currentBalance = await getLatestCreditBalance(client, actualUserId);
        if (!Number.isFinite(currentBalance) || currentBalance < 1) {
          const err: any = new Error('?¬ë ˆ?§ì´ ë¶€ì¡±í•©?ˆë‹¤.');
          err.statusCode = 402;
          throw err;
        }

        await appendCreditHistory(client, {
          userId: actualUserId,
          amount: -1,
          description: '?ìƒ ?¬ë¶„??,
          type: 'analysis',
        });

        creditDeducted = true;
      }

      // ?€?€ ?¼ë°˜ ?¬ë ˆ??ì°¨ê° + ?€?„íŒ¨??ad_free_until) ê°±ì‹  ?€?€
      // REFACTORED_BY_MERLIN_HUB: t_users ?¬ë ˆ??ì°¨ê° ??Hub wallet ?´ê? ?ˆì •
      if (!isRecheck && actualUserId && !actualUserId.startsWith('anon_') && !actualUserId.startsWith('trial_')) {
        await ensureCreditHistoryTable(client);
        const currentBalance = await getLatestCreditBalance(client, actualUserId);
        if (!Number.isFinite(currentBalance) || currentBalance < 30) {
          const err: any = new Error('?¬ë ˆ?§ì´ ë¶€ì¡±í•©?ˆë‹¤. ì¶©ì „ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.');
          err.statusCode = 402;
          throw err;
        }

        const newBalance = await appendCreditHistory(client, {
          userId: actualUserId,
          amount: -30,
          description: '?ìƒ ë¶„ì„',
          type: 'analysis',
        });

        creditDeducted = true;
        console.log(`[Credit] userId=${actualUserId}, -30C ??balance=${newBalance}`);
      }

      // 5-5. ì±„ë„ êµ¬ë… ì²˜ë¦¬
      if (actualUserId && hasTranscript) {
        console.log('5-5. ì±„ë„ êµ¬ë… ì²˜ë¦¬ ?œì‘...');
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
        console.log('êµ¬ë… ì²˜ë¦¬ ?„ë£Œ');
      }

      await client.query('COMMIT');
      console.log('DB ?€???„ë£Œ:', analysisId);

      await refreshRankingCache(videoInfo.officialCategoryId)
        .catch(err => {
          console.error('??‚¹ ìºì‹œ ê°±ì‹  ?¤íŒ¨:', err);
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
        ? '?¬ê? ê²°ê³¼ ? ë¢°???ìˆ˜ê°€ ?˜ë½?˜ì—¬ ê¸°ì¡´ ë¶„ì„ ê²°ê³¼ë¥?? ì??©ë‹ˆ??'
        : 'ë¶„ì„???„ë£Œ?˜ì—ˆ?µë‹ˆ??',
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
    console.error('ë¶„ì„ ?”ì²­ ?¤ë¥˜:', error);
    const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500;
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'ë¶„ì„ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.' 
    }, { status: statusCode, headers: corsHeaders });
  }
}
