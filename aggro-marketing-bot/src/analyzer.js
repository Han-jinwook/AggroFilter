const axios = require('axios');
const { mainAppUrl, analysisDelayMs } = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 분석 완료 여부를 폴링으로 확인 (최대 10분, 15초 간격)
 */
async function pollUntilComplete(videoId, maxWaitMs = 600000) {
  const interval = 15000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await sleep(interval);
    try {
      const res = await axios.get(`${mainAppUrl}/api/analysis/status`, {
        params: { videoId },
        timeout: 10000,
      });
      if (res.data?.status === 'completed') {
        return { completed: true, analysisId: res.data.analysisId };
      }
    } catch (e) {
      // 폴링 실패는 무시하고 재시도
    }
  }
  return { completed: false };
}

/**
 * 메인 앱 /api/analysis/request 를 HTTP로 호출하여 분석 요청
 * - 504 대응: 요청 후 폴링으로 완료 확인
 * - userId = 'bot' 으로 고정 → DB에서 봇 분석 필터링 가능
 */
async function analyzeVideo(video) {
  console.log(`  [Analyzer] 분석 요청: ${video.title}`);

  // 1. 분석 요청 (504가 와도 서버는 백그라운드에서 계속 처리 중)
  try {
    const res = await axios.post(
      `${mainAppUrl}/api/analysis/request`,
      {
        url: video.url,
        userId: 'bot',
        isRecheck: false,
        forceRecheck: false,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 320000,
      }
    );

    const data = res.data;
    if (data.error) {
      console.warn(`  [Analyzer] 분석 오류 (${video.title}): ${data.error}`);
      return { success: false, video, error: data.error };
    }
    console.log(`  [Analyzer] 완료 (신뢰도: ${data.reliabilityScore ?? data.score ?? '?'}) — ${video.title}`);
    return { success: true, video, result: data };

  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message;

    // 504는 서버가 백그라운드에서 계속 처리 중 → 폴링으로 완료 대기
    if (status === 504 || err.code === 'ECONNABORTED') {
      console.warn(`  [Analyzer] 504/타임아웃 → 폴링 대기 시작: ${video.title}`);
      const poll = await pollUntilComplete(video.videoId);
      if (poll.completed) {
        console.log(`  [Analyzer] 폴링 완료 확인 — ${video.title}`);
        return { success: true, video, result: { analysisId: poll.analysisId } };
      }
      console.error(`  [Analyzer] 폴링 타임아웃 (10분 초과) — ${video.title}`);
      return { success: false, video, error: '폴링 타임아웃' };
    }

    console.error(`  [Analyzer] 실패 (${video.title}): ${msg}`);
    return { success: false, video, error: msg };
  }
}

/**
 * 수집된 영상 목록을 순차적으로 분석
 * Rate Limit 방어: 각 요청 사이 analysisDelayMs 딜레이
 */
async function analyzeVideos(videos) {
  const results = { success: 0, fail: 0, errors: [] };

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`\n[Analyzer] ${i + 1}/${videos.length} 처리 중...`);

    const result = await analyzeVideo(video);

    if (result.success) {
      results.success++;
    } else {
      results.fail++;
      results.errors.push({ title: video.title, error: result.error });
    }

    // 마지막 영상이 아닐 때만 딜레이
    if (i < videos.length - 1) {
      console.log(`  [Analyzer] ${analysisDelayMs / 1000}초 대기 중...`);
      await sleep(analysisDelayMs);
    }
  }

  return results;
}

module.exports = { analyzeVideos };
