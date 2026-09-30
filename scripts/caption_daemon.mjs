import pkg from 'pg';
const { Pool } = pkg;
import { fetchTranscript } from 'youtube-transcript-plus';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[CaptionWorker] ❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

let isProcessing = false;
let processedCount = 0;
let errorCount = 0;
let consecutiveErrors = 0;

/**
 * 텔레그램 경보 알림 전송 헬퍼 (옵션)
 */
async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('[CaptionWorker] 텔레그램 알림 전송 실패:', err?.message || err);
  }
}

/**
 * 유튜브 자막 추출 헬퍼 (youtube-transcript-plus + fallback)
 */
async function fetchCaptions(videoId) {
  // 1차: youtube-transcript-plus (최신 유튜브 패치 대응)
  try {
    const items = await fetchTranscript(videoId);
    if (items && items.length > 0) {
      return {
        success: true,
        items: items.map(it => ({
          text: it.text,
          start: it.offset !== undefined ? it.offset : it.start,
          duration: it.duration
        })),
        text: items.map(it => it.text).join(' ')
      };
    }
  } catch (err1) {
    const isNoSub = err1.message?.includes('No transcripts are available');
    if (isNoSub) {
      return { success: false, noTranscript: true, error: '자막이 제공되지 않는 영상입니다.' };
    }
  }

  // 2차: youtube-transcript fallback
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    if (items && items.length > 0) {
      return {
        success: true,
        items: items.map(it => ({
          text: it.text,
          start: it.offset !== undefined ? it.offset : it.start,
          duration: it.duration
        })),
        text: items.map(it => it.text).join(' ')
      };
    }
  } catch (err2) {
    const isNoSub = err2.message?.includes('No transcripts') || err2.message?.includes('Could not find transcripts');
    if (isNoSub) {
      return { success: false, noTranscript: true, error: '자막이 제공되지 않는 영상입니다.' };
    }
    return { success: false, error: err2.message || '자막 추출 실패' };
  }

  return { success: false, error: '자막 데이터를 찾을 수 없습니다.' };
}

/**
 * 큐에 쌓인 PENDING 작업 1건 처리
 */
async function processNextTask() {
  if (isProcessing) return;
  isProcessing = true;

  let client;
  let hasMore = false;
  try {
    client = await pool.connect();

    // 동시성 락을 걸고 가장 오래된 PENDING 작업 1건 획득 (SKIP LOCKED)
    const pickRes = await client.query(`
      SELECT f_id, f_video_id
      FROM t_caption_tasks
      WHERE f_status = 'PENDING'
      ORDER BY f_created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1;
    `);

    if (pickRes.rows.length === 0) {
      isProcessing = false;
      client.release();
      return;
    }

    const task = pickRes.rows[0];
    const taskId = task.f_id;
    const videoId = task.f_video_id;

    console.log(`\n[CaptionWorker] 🚀 [작업 시작] Task ID: ${taskId}, Video ID: ${videoId}`);
    await client.query(`UPDATE t_caption_tasks SET f_status = 'PROCESSING', f_updated_at = NOW() WHERE f_id = $1`, [taskId]);

    // DB 트랜잭션 락 해제 후 자막 네트워크 요청
    client.release();
    client = null;

    const startTime = Date.now();
    const result = await fetchCaptions(videoId);
    const elapsed = Date.now() - startTime;

    client = await pool.connect();
    if (result.success) {
      await client.query(`
        UPDATE t_caption_tasks
        SET f_status = 'READY',
            f_transcript = $1,
            f_transcript_items = $2,
            f_error = NULL,
            f_updated_at = NOW()
        WHERE f_id = $3
      `, [
        result.text,
        JSON.stringify(result.items),
        taskId
      ]);

      processedCount++;
      consecutiveErrors = 0;
      console.log(`[CaptionWorker] ✅ [완료] Video: ${videoId} | ${result.items.length}줄 (${result.text.length}자) | 소요시간: ${elapsed}ms`);
    } else if (result.noTranscript) {
      await client.query(`
        UPDATE t_caption_tasks
        SET f_status = 'NO_TRANSCRIPT',
            f_transcript = '',
            f_transcript_items = '[]'::jsonb,
            f_error = $1,
            f_updated_at = NOW()
        WHERE f_id = $2
      `, [result.error, taskId]);

      consecutiveErrors = 0;
      console.log(`[CaptionWorker] ℹ️ [자막 없음] Video: ${videoId} (${result.error})`);
    } else {
      errorCount++;
      consecutiveErrors++;
      await client.query(`
        UPDATE t_caption_tasks
        SET f_status = 'FAILED',
            f_error = $1,
            f_updated_at = NOW()
        WHERE f_id = $2
      `, [result.error, taskId]);

      console.error(`[CaptionWorker] ❌ [실패] Video: ${videoId} Error: ${result.error}`);

      if (consecutiveErrors >= 3) {
        await sendTelegramAlert(
          `🚨 <b>[어그로필터 로컬 워커 경보]</b>\n연속 ${consecutiveErrors}회 자막 추출에 실패했습니다.\n- 마지막 영상: ${videoId}\n- 오류: ${result.error}\n네트워크 또는 유튜브 IP 차단 여부를 점검해주세요.`
        );
      }
    }

    // 큐에 대기 중인 다른 작업이 있는지 확인 (버스트 모드)
    const checkMore = await client.query(`SELECT 1 FROM t_caption_tasks WHERE f_status = 'PENDING' LIMIT 1`);
    hasMore = checkMore.rows.length > 0;

  } catch (err) {
    errorCount++;
    consecutiveErrors++;
    console.error('[CaptionWorker] ❌ 작업 처리 중 예외 발생:', err);
  } finally {
    if (client) client.release();
    isProcessing = false;
    // 대기 중인 작업이 있으면 즉시 다음 작업 처리
    if (hasMore) {
      setImmediate(processNextTask);
    }
  }
}

/**
 * 메인 루프 (1.5초 폴링 + 연속 처리)
 */
async function startDaemon() {
  console.log('====================================================');
  console.log('  🛡️ 어그로필터 24시간 로컬 자막 추출 데몬 (Ninja Worker)');
  console.log('  - 모바일/웹 유저 자막 배달 큐: t_caption_tasks');
  console.log('  - 상주 감시 주기: 1.5초 폴링 + 버스트 모드');
  console.log('====================================================');

  // 최초 기동 시 미처리 backlog 큐 즉시 확인
  await processNextTask();

  // 상주 감시 인터벌 (1.5초 간격)
  setInterval(async () => {
    try {
      await processNextTask();
    } catch {}
  }, 1500);

  // 1분마다 상태 하트비트 로그
  setInterval(() => {
    const now = new Date().toLocaleTimeString('ko-KR');
    console.log(`[CaptionWorker] 🟢 [${now}] 상주 대기 중... (누적 성공: ${processedCount}건, 실패: ${errorCount}건)`);
  }, 60000);
}

startDaemon().catch(err => {
  console.error('[CaptionWorker] 치명적 오류로 데몬 중단:', err);
  process.exit(1);
});
