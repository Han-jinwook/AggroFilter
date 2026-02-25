/**
 * 섹션2: 댓글 큐 처리기
 * - bot_comment_logs의 status='queue' 항목을 순서대로 처리
 * - target_type에 따라 youtube-commenter 또는 fmkorea-commenter 호출
 * - 각 댓글 사이 1~2분 랜덤 딜레이 (Anti-Spam)
 */
const { getCommentLogs, updateCommentLogStatus } = require('./db');
const { postYoutubeComment } = require('./youtube-commenter');
const { postFmkoreaComment } = require('./fmkorea-commenter');
const config = require('./config');

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * 큐에 쌓인 댓글을 순서대로 실행
 * @returns {{ processed, done, errored }}
 */
async function processCommentQueue() {
  const queue = await getCommentLogs({ limit: 50, status: 'queue' });

  if (queue.length === 0) {
    console.log('[Queue] 처리할 댓글 없음.');
    return { processed: 0, done: 0, errored: 0 };
  }

  console.log(`[Queue] 댓글 큐 처리 시작 — ${queue.length}개`);
  let done = 0;
  let errored = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    console.log(`[Queue] [${i + 1}/${queue.length}] type=${item.target_type} id=${item.target_id}`);

    try {
      if (item.target_type === 'youtube') {
        if (!item.video_id) throw new Error('video_id 없음');
        await postYoutubeComment(item.video_id, item.generated_text);
      } else if (item.target_type === 'community') {
        if (!item.target_url) throw new Error('target_url 없음');
        await postFmkoreaComment(item.target_url, item.generated_text);
      } else {
        throw new Error(`알 수 없는 target_type: ${item.target_type}`);
      }
      await updateCommentLogStatus(item.id, 'done');
      done++;
    } catch (e) {
      console.error(`[Queue] ❌ 실패 (id=${item.id}): ${e.message}`);
      await updateCommentLogStatus(item.id, 'error', e.message);
      errored++;
    }

    // 마지막 항목이 아닐 때만 딜레이
    if (i < queue.length - 1) {
      const delay = randomDelay(config.commentDelayMinMs, config.commentDelayMaxMs);
      console.log(`[Queue] 다음 댓글까지 ${Math.round(delay / 1000)}초 대기...`);
      await sleep(delay);
    }
  }

  console.log(`[Queue] 완료 — 성공: ${done}, 실패: ${errored}`);
  return { processed: queue.length, done, errored };
}

module.exports = { processCommentQueue };
