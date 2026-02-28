const { collectTargetVideos, collectType1Only, collectType2Only } = require('./youtube-collector');
const { analyzeVideos } = require('./analyzer');
const { getTranscriptData } = require('./youtube-meta');
const { getRecentlyAnalyzedVideoIds, getRecentlyAnalyzedChannelIds, getRecentlyAnalyzedChannelsByCategoryMap } = require('./db');
const defaultConfig = require('./config');

/**
 * 공통: 자막 수집 + 자막없는 영상 필터링 + 분석 실행
 */
async function _collectTranscriptAndAnalyze(videos, options, label) {
  if (videos.length === 0) {
    console.log(`[Job][${label}] 새로 분석할 영상 없음. 종료.`);
    return { success: 0, fail: 0, skipped: 0, errors: [] };
  }

  // 자막 수집
  console.log(`\n[Job][${label}] 자막 수집 시작 (총 ${videos.length}개)...`);
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    console.log(`  자막 (${i + 1}/${videos.length}): ${v.title}`);
    const meta = await getTranscriptData(v.videoId);
    v.transcript = meta.transcript;
    v.transcriptItems = meta.transcriptItems;
    v.hasTranscript = meta.hasTranscript;
  }

  const noTranscript = videos.filter(v => !v.hasTranscript);
  const analysisTargets = videos.filter(v => v.hasTranscript);
  console.log(`[Job][${label}] 자막 완료: ${analysisTargets.length}개 분석 대상 / ${noTranscript.length}개 자막없음 제외`);
  if (noTranscript.length > 0) {
    noTranscript.forEach(v => console.log(`  - 자막없음 스킵: ${v.title}`));
  }

  if (analysisTargets.length === 0) {
    console.log(`[Job][${label}] 자막 있는 영상이 없어 분석을 건너뜁니다.`);
    return { success: 0, fail: 0, skipped: noTranscript.length, errors: [] };
  }

  // 분석
  console.log(`\n[Job][${label}] 분석 시작 (${analysisTargets.length}개)...`);
  const results = await analyzeVideos(analysisTargets, options);
  return { ...results, skipped: noTranscript.length };
}

/**
 * 자동 스케줄 잡 — Type1+2 수집 → 자막 → 분석 등록까지
 * (댓글/커뮤니티 모듈은 2차 작업으로 분리)
 */
async function runJob(options = {}) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job] 자동 실행 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`[Job] 옵션: N=${options.trackNTotal ?? defaultConfig.trackNTotal}, M=${options.trackMPerCategory ?? defaultConfig.trackMPerCategory}, X=${dedupDays}일, 딜레이=${options.analysisDelayMs ?? defaultConfig.analysisDelayMs}ms`);
  console.log(`${'='.repeat(60)}`);

  try {
    console.log(`\n[Job] 중복 체크 (최근 ${dedupDays}일)...`);
    const categoryCooldowns = options.categoryCooldowns || {};
    const hasCategoryCooldowns = Object.keys(categoryCooldowns).length > 0;
    const [recentVideoIds, recentChannelMap] = await Promise.all([
      getRecentlyAnalyzedVideoIds(dedupDays),
      hasCategoryCooldowns
        ? getRecentlyAnalyzedChannelsByCategoryMap(categoryCooldowns, dedupDays)
        : getRecentlyAnalyzedChannelIds(dedupDays),
    ]);
    console.log(`[Job] 기분석 영상: ${recentVideoIds.size}개, 채널: ${recentChannelMap.size}개${hasCategoryCooldowns ? ' (카테고리별 쿨타임 적용)' : ''}`);

    console.log('\n[Job] YouTube Type1+2 수집 시작...');
    const videos = await collectTargetVideos(recentVideoIds, recentChannelMap, options);

    const results = await _collectTranscriptAndAnalyze(videos, options, '자동');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Job] 완료 — 소요: ${elapsed}초`);
    console.log(`  분석 성공: ${results.success}개 / 실패: ${results.fail}개 / 자막없음 제외: ${results.skipped}개`);
    if (results.errors?.length > 0) {
      results.errors.forEach((e) => console.log(`    - ${e.title}: ${e.error}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return results;
  } catch (err) {
    console.error('[Job] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

/**
 * Type1 수동 실행 — 전체 트렌드 수집 → 자막 → 분석
 */
async function runJobType1(options = {}) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job][Type1] 수동 실행 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const categoryCooldowns = options.categoryCooldowns || {};
    const hasCategoryCooldowns = Object.keys(categoryCooldowns).length > 0;
    const [recentVideoIds, recentChannelMap] = await Promise.all([
      getRecentlyAnalyzedVideoIds(dedupDays),
      hasCategoryCooldowns
        ? getRecentlyAnalyzedChannelsByCategoryMap(categoryCooldowns, dedupDays)
        : getRecentlyAnalyzedChannelIds(dedupDays),
    ]);

    const videos = await collectType1Only(recentVideoIds, recentChannelMap, options);
    const results = await _collectTranscriptAndAnalyze(videos, options, 'Type1');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Job][Type1] 완료 — 소요: ${elapsed}초 | 성공: ${results.success}개 / 실패: ${results.fail}개 / 자막없음: ${results.skipped}개`);
    return results;
  } catch (err) {
    console.error('[Job][Type1] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

/**
 * Type2 수동 실행 — 카테고리별 수집 → 자막 → 분석
 */
async function runJobType2(options = {}) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job][Type2] 수동 실행 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const [recentVideoIds, recentChannelIds] = await Promise.all([
      getRecentlyAnalyzedVideoIds(dedupDays),
      getRecentlyAnalyzedChannelIds(dedupDays),
    ]);

    const videos = await collectType2Only(recentVideoIds, recentChannelIds, options);
    const results = await _collectTranscriptAndAnalyze(videos, options, 'Type2');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Job][Type2] 완료 — 소요: ${elapsed}초 | 성공: ${results.success}개 / 실패: ${results.fail}개 / 자막없음: ${results.skipped}개`);
    return results;
  } catch (err) {
    console.error('[Job][Type2] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

module.exports = { runJob, runJobType1, runJobType2 };
