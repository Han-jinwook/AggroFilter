const { collectTargetVideos } = require('./youtube-collector');
const { analyzeVideos } = require('./analyzer');
const { getRecentlyAnalyzedVideoIds, getRecentlyAnalyzedChannelIds } = require('./db');
const defaultConfig = require('./config');

/**
 * 메인 잡 — 수집 → 중복 제거 → 순차 분석
 * @param {object} options - 대시보드에서 전달된 런타임 옵션 (없으면 config 기본값 사용)
 * @returns {{ success: number, fail: number, errors: Array }}
 */
async function runJob(options = {}) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job] 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`[Job] 옵션: N=${options.trackNTotal ?? defaultConfig.trackNTotal}, M=${options.trackMPerCategory ?? defaultConfig.trackMPerCategory}, X=${dedupDays}일, 딜레이=${options.analysisDelayMs ?? defaultConfig.analysisDelayMs}ms`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. 최근 분석된 video/channel ID 조회 (중복 방지)
    console.log(`\n[Job] 중복 체크 (최근 ${dedupDays}일)...`);
    const [recentVideoIds, recentChannelIds] = await Promise.all([
      getRecentlyAnalyzedVideoIds(dedupDays),
      getRecentlyAnalyzedChannelIds(dedupDays),
    ]);
    console.log(`[Job] 기분석 영상: ${recentVideoIds.size}개, 채널: ${recentChannelIds.size}개`);

    // 2. YouTube 2-Track 수집
    console.log('\n[Job] YouTube 2-Track 수집 시작...');
    const videos = await collectTargetVideos(recentVideoIds, recentChannelIds, options);

    if (videos.length === 0) {
      console.log('[Job] 새로 분석할 영상 없음. 종료.');
      return { success: 0, fail: 0, errors: [] };
    }

    // 3. 순차 분석 (메인 앱 API 호출)
    console.log(`\n[Job] 분석 시작 (총 ${videos.length}개)...`);
    const results = await analyzeVideos(videos, options);

    // 4. 결과 리포트
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Job] 완료 — 소요: ${elapsed}초`);
    console.log(`  성공: ${results.success}개 / 실패: ${results.fail}개`);
    if (results.errors.length > 0) {
      console.log('  실패 목록:');
      results.errors.forEach((e) => console.log(`    - ${e.title}: ${e.error}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return results;
  } catch (err) {
    console.error('[Job] 치명적 오류:', err);
    return { success: 0, fail: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

module.exports = { runJob };
