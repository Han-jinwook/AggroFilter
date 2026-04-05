const { collectTargetVideos, collectType1Only, collectType2Only, collectSection2Only, collectSection3 } = require('./youtube-collector');
const { analyzeVideos } = require('./analyzer');
const { getTranscriptData } = require('./youtube-meta');
const { getRecentlyAnalyzedVideoIds, getRecentlyAnalyzedChannelIds, getRecentlyAnalyzedChannelsByCategoryMap, getWatchlistChannels, autoPopulateWatchlist, updateWatchlistLastSearched } = require('./db');
const { batchScoreAggro, checkOllamaConnection } = require('./aggro-prescorer');
const defaultConfig = require('./config');

// 섹션2 작업 중단 플래그
let section2AbortFlag = false;
function abortSection2() { section2AbortFlag = true; }
function resetSection2Abort() { section2AbortFlag = false; }

// 섹션3 작업 중단 플래그
let section3AbortFlag = false;
function abortSection3() { section3AbortFlag = true; }
function resetSection3Abort() { section3AbortFlag = false; }

/**
 * 공통: 자막 수집 + 자막없는 영상 필터링 + 분석 실행
 * targetCount: 목표로 하는 분석 완료 개수 (N 또는 M)
 */
async function _collectTranscriptAndAnalyze(videos, options, label, targetCount) {
  if (videos.length === 0) {
    console.log(`[Job][${label}] 새로 분석할 영상 없음. 종료.`);
    return { success: 0, fail: 0, skipped: 0, errors: [] };
  }

  const limit = targetCount || videos.length;
  console.log(`\n[Job][${label}] 작업 시작: 후보 ${videos.length}개 중 최대 ${limit}개 분석 목표`);

  const analysisTargets = [];
  let skippedCount = 0;

  // 블랙리스트 카테고리 — 자막 확인 전 즉시 차단 (API 비용 절감)
  const BLACKLIST_CATEGORY_IDS = new Set(['1','2','10','15','17','19','20','23','43']);

  // 자막 수집 및 대상 선정 (목표 개수를 채울 때까지)
  for (let i = 0; i < videos.length; i++) {
    if (analysisTargets.length >= limit) {
      console.log(`  [Job][${label}] 목표 개수(${limit})를 채웠습니다. 추가 수집 중단.`);
      break;
    }

    const v = videos[i];
    const catId = String(v.categoryId || v.officialCategoryId || '');
    if (catId && BLACKLIST_CATEGORY_IDS.has(catId)) {
      console.log(`  자막 확인 (${i + 1}/${videos.length}): ${v.title}`);
      console.log(`    -> 블랙리스트 카테고리(${catId}) 스킵`);
      skippedCount++;
      continue;
    }

    console.log(`  자막 확인 (${i + 1}/${videos.length}): ${v.title}`);
    const meta = await getTranscriptData(v.videoId);
    
    if (meta.hasTranscript) {
      v.transcript = meta.transcript;
      v.transcriptItems = meta.transcriptItems;
      v.hasTranscript = true;
      analysisTargets.push(v);
      console.log(`    -> 분석 대상 확정 (${analysisTargets.length}/${limit})`);
    } else {
      console.log(`    -> 자막 없음 스킵`);
      skippedCount++;
    }
  }

  if (analysisTargets.length === 0) {
    console.log(`[Job][${label}] 자막 있는 영상이 없어 분석을 건너뜁니다.`);
    return { success: 0, fail: 0, skipped: skippedCount, errors: [] };
  }

  // 분석 실행
  console.log(`\n[Job][${label}] 분석 시작 (${analysisTargets.length}개)...`);
  const results = await analyzeVideos(analysisTargets, options);
  return { ...results, skipped: skippedCount };
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

    // Type1(트렌드)과 Type2(카테고리)가 섞여있으므로 분리해서 처리하거나 전체로 처리
    // 여기서는 전체를 순차적으로 처리하되, 전체 목표는 N + (M * 카테고리수) 정도로 볼 수 있음
    const n = options.trackNTotal ?? defaultConfig.trackNTotal;
    const m = options.trackMPerCategory ?? defaultConfig.trackMPerCategory;
    const totalTarget = n + (m * defaultConfig.targetCategories.length);

    const results = await _collectTranscriptAndAnalyze(videos, options, '자동', totalTarget);

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

    const n = options.trackNTotal ?? defaultConfig.trackNTotal;
    const videos = await collectType1Only(recentVideoIds, recentChannelMap, options);
    const results = await _collectTranscriptAndAnalyze(videos, options, '수동/트렌드', n);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Job][수동/트렌드] 완료 — 소요: ${elapsed}초 | 성공: ${results.success}개 / 실패: ${results.fail}개 / 자막없음: ${results.skipped}개`);
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

    const m = options.trackMPerCategory ?? defaultConfig.trackMPerCategory;
    const videos = await collectType2Only(recentVideoIds, recentChannelIds, options);
    const results = await _collectTranscriptAndAnalyze(videos, options, 'Type2', m * defaultConfig.targetCategories.length);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Job][Type2] 완료 — 소요: ${elapsed}초 | 성공: ${results.success}개 / 실패: ${results.fail}개 / 자막없음: ${results.skipped}개`);
    return results;
  } catch (err) {
    console.error('[Job][Type2] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

/**
 * 섹션2 실행 — 어그로 키워드 사냥 (섹션2 핵심)
 * 파이프라인: 수집 → 자막 → 오픈소스 AI 사전 스코어링 → 컷라인 필터 → 유료 분석
 */
async function runJobSection2(options = {}, statusCallback = null) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const cutoff = options.aggroPreScoreCutoff ?? defaultConfig.aggroPreScoreCutoff ?? 31;
  const dailyLimit = options.aggroDailyAnalysisLimit ?? defaultConfig.aggroDailyAnalysisLimit ?? 30;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job][Section2] 어그로 키워드 사냥 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`[Job][Section2] 사전필터 컷라인: ${cutoff}점, 유료분석 일일한도: ${dailyLimit}개`);
  console.log(`${'='.repeat(60)}`);

  // 중단 플래그 초기화
  resetSection2Abort();

  // 상태 초기화
  if (statusCallback) {
    statusCallback({ 
      currentStep: '초기화 중', 
      collectedCount: 0, 
      transcriptCount: 0, 
      preScoreCount: 0, 
      passedCutoff: 0, 
      analyzingCount: 0,
      totalToAnalyze: 0
    });
  }

  try {
    // 중단 체크
    if (section2AbortFlag) {
      console.log(`[Job][Section2] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 0. Ollama 연결 확인
    const ollamaStatus = await checkOllamaConnection();
    if (!ollamaStatus.connected) {
      console.error(`[Job][Section2] ❌ Ollama 미연결: ${ollamaStatus.error}`);
      console.error(`  → Ollama 설치/실행 후 재시도. 설치: https://ollama.com`);
      return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'ollama', error: ollamaStatus.error }] };
    }
    if (!ollamaStatus.hasRequiredModel) {
      console.error(`[Job][Section2] ❌ 필요 모델 없음: ${ollamaStatus.requiredModel}`);
      console.error(`  → ollama pull ${ollamaStatus.requiredModel} 실행 필요`);
      console.error(`  → 보유 모델: ${ollamaStatus.models.join(', ') || '없음'}`);
      return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'model', error: `${ollamaStatus.requiredModel} 없음` }] };
    }
    console.log(`[Job][Section2] ✅ Ollama 연결 OK (모델: ${ollamaStatus.requiredModel})`);

    // 1. 중복 체크
    console.log(`\n[Job][Section2] 중복 체크 (최근 ${dedupDays}일)...`);
    const [recentVideoIds, recentChannelMap] = await Promise.all([
      getRecentlyAnalyzedVideoIds(dedupDays),
      getRecentlyAnalyzedChannelIds(dedupDays),
    ]);
    console.log(`[Job][Section2] 기분석 영상: ${recentVideoIds.size}개, 채널: ${recentChannelMap.size}개`);

    // 중단 체크
    if (section2AbortFlag) {
      console.log(`[Job][Section2] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 2. 어그로 키워드 수집
    if (statusCallback) statusCallback({ currentStep: '키워드 수집 중', collectedCount: 0 });
    const videos = await collectSection2Only(recentVideoIds, recentChannelMap, options);
    if (statusCallback) statusCallback({ collectedCount: videos.length });
    
    if (videos.length === 0) {
      console.log(`[Job][Section2] 수집된 후보 없음. 종료.`);
      return { success: 0, fail: 0, skipped: 0, errors: [] };
    }

    // 중단 체크
    if (section2AbortFlag) {
      console.log(`[Job][Section2] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 3. 자막 수집
    if (statusCallback) statusCallback({ currentStep: '자막 수집 중', transcriptCount: 0 });
    console.log(`\n[Job][Section2] 자막 수집 시작 (${videos.length}개)...`);
    const BLACKLIST_CATEGORY_IDS = new Set(['1','2','10','15','17','19','20','23','43']);
    const withTranscript = [];
    let noTranscriptCount = 0;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const catId = String(v.categoryId || '');
      if (catId && BLACKLIST_CATEGORY_IDS.has(catId)) {
        noTranscriptCount++;
        continue;
      }

      console.log(`  자막 (${i + 1}/${videos.length}): ${v.title.substring(0, 40)}...`);
      const meta = await getTranscriptData(v.videoId);
      if (meta.hasTranscript) {
        v.transcript = meta.transcript;
        v.transcriptItems = meta.transcriptItems;
        withTranscript.push(v);
        if (statusCallback) statusCallback({ transcriptCount: withTranscript.length });
      } else {
        noTranscriptCount++;
      }
    }
    console.log(`[Job][Section2] 자막 있는 후보: ${withTranscript.length}개 (자막없음: ${noTranscriptCount}개)`);

    if (withTranscript.length === 0) {
      return { success: 0, fail: 0, skipped: noTranscriptCount, errors: [] };
    }

    // 중단 체크
    if (section2AbortFlag) {
      console.log(`[Job][Section2] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 4. 오픈소스 AI 사전 스코어링
    if (statusCallback) statusCallback({ currentStep: 'Ollama 사전 스코어링 중', preScoreCount: 0 });
    console.log(`\n[Job][Section2] 오픈소스 AI 사전 스코어링 시작...`);
    const scores = await batchScoreAggro(withTranscript, (progress) => {
      if (statusCallback) statusCallback({ preScoreCount: progress });
    });

    // Ollama 점수를 DB에 저장
    const { saveOllamaScores } = require('./db');
    await saveOllamaScores(withTranscript, scores);

    // 5. 컷라인 필터
    const scoreMap = new Map(scores.map(s => [s.videoId, s]));
    const filtered = withTranscript.filter(v => {
      const s = scoreMap.get(v.videoId);
      return s && s.score >= cutoff;
    });

    // 일일 한도 적용
    const toAnalyze = filtered.slice(0, dailyLimit);

    if (statusCallback) statusCallback({ passedCutoff: filtered.length, totalToAnalyze: toAnalyze.length });
    console.log(`\n[Job][Section2] 사전필터 결과: ${scores.length}건 스코어링 → ${filtered.length}건 컷라인(${cutoff}점) 통과 → ${toAnalyze.length}건 유료분석 대상`);

    if (toAnalyze.length === 0) {
      console.log(`[Job][Section2] 컷라인 통과 영상 없음. 종료.`);
      return { success: 0, fail: 0, skipped: withTranscript.length, preScored: scores.length, errors: [] };
    }

    // 중단 체크
    if (section2AbortFlag) {
      console.log(`[Job][Section2] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 6. 유료 정식 AI 분석
    if (statusCallback) statusCallback({ currentStep: 'LLM 유료 분석 중', analyzingCount: 0 });
    console.log(`\n[Job][Section2] 유료 분석 시작 (${toAnalyze.length}개)...`);
    const results = await analyzeVideos(toAnalyze, options, (progress) => {
      if (statusCallback) statusCallback({ analyzingCount: progress });
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Job][Section2] 완료 — 소요: ${elapsed}초`);
    console.log(`  수집: ${videos.length}개 → 자막: ${withTranscript.length}개 → 사전스코어: ${scores.length}건 → 컷라인통과: ${filtered.length}건 → 유료분석: ${toAnalyze.length}개`);
    console.log(`  분석 성공: ${results.success}개 / 실패: ${results.fail}개`);
    if (results.errors?.length > 0) {
      results.errors.forEach(e => console.log(`    - ${e.title}: ${e.error}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return {
      ...results,
      skipped: noTranscriptCount,
      preScored: scores.length,
      passedCutoff: filtered.length,
    };
  } catch (err) {
    console.error('[Job][Section2] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

/**
 * 섹션3 실행 — 요주의 채널 딥다이브
 * 파이프라인: 워치리스트 자동채움 → 채널별 수집 → 자막 → 분석
 */
async function runJobSection3(options = {}, statusCallback = null) {
  const dedupDays = options.dedupDays ?? defaultConfig.dedupDays;
  const cutoff = options.aggroCutoff ?? 80;
  const searchDays = options.searchDays ?? 3;
  const searchMode = options.searchMode ?? 'viewCount';
  const maxPerChannel = options.maxPerChannel ?? 3;
  const dailyLimit = options.dailyAnalysisLimit ?? 20;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Job][Section3] 요주의 채널 딥다이브 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`[Job][Section3] 어그로 임계값: ${cutoff}점, 서칭 범위: ${searchDays}일, 모드: ${searchMode}`);
  console.log(`${'='.repeat(60)}`);

  resetSection3Abort();

  if (statusCallback) {
    statusCallback({
      currentStep: '초기화 중',
      watchlistCount: 0,
      collectedCount: 0,
      transcriptCount: 0,
      analyzingCount: 0,
      totalToAnalyze: 0,
    });
  }

  try {
    if (section3AbortFlag) {
      console.log(`[Job][Section3] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 1. 워치리스트 자동 채움
    if (statusCallback) statusCallback({ currentStep: '워치리스트 자동 갱신 중' });
    console.log(`\n[Job][Section3] 워치리스트 자동 갱신 (cutoff: ${cutoff}점)...`);
    const populated = await autoPopulateWatchlist(cutoff);
    console.log(`[Job][Section3] 워치리스트 갱신: ${populated}개 채널 업데이트`);

    // 2. 활성 채널 로드 + 서칭 주기 필터
    const allChannels = await getWatchlistChannels(true);
    const now = Date.now();
    const searchCooldownMs = searchDays * 24 * 60 * 60 * 1000;
    const channels = allChannels.filter(ch => {
      if (!ch.last_searched_at) return true;
      return (now - new Date(ch.last_searched_at).getTime()) >= searchCooldownMs;
    });

    if (statusCallback) statusCallback({ watchlistCount: channels.length });
    console.log(`[Job][Section3] 활성 채널: ${allChannels.length}개 중 서칭 대상: ${channels.length}개`);

    if (channels.length === 0) {
      console.log(`[Job][Section3] 서칭 대상 채널 없음. 종료.`);
      return { success: 0, fail: 0, skipped: 0, watchlistTotal: allChannels.length };
    }

    if (section3AbortFlag) {
      console.log(`[Job][Section3] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 3. 중복 체크
    const recentVideoIds = await getRecentlyAnalyzedVideoIds(dedupDays);

    // 4. 채널별 영상 수집
    if (statusCallback) statusCallback({ currentStep: '채널별 영상 수집 중' });
    const videos = await collectSection3(channels, recentVideoIds, { searchDays, searchMode, maxPerChannel });
    if (statusCallback) statusCallback({ collectedCount: videos.length });

    // 서칭 완료한 채널의 last_searched_at 업데이트
    for (const ch of channels) {
      await updateWatchlistLastSearched(ch.channel_id);
    }

    if (videos.length === 0) {
      console.log(`[Job][Section3] 수집된 영상 없음. 종료.`);
      return { success: 0, fail: 0, skipped: 0, watchlistTotal: allChannels.length };
    }

    if (section3AbortFlag) {
      console.log(`[Job][Section3] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 5. 자막 수집
    if (statusCallback) statusCallback({ currentStep: '자막 수집 중', transcriptCount: 0 });
    console.log(`\n[Job][Section3] 자막 수집 시작 (${videos.length}개)...`);
    const BLACKLIST_CATEGORY_IDS = new Set(['1','2','10','15','17','19','20','23','43']);
    const withTranscript = [];
    let noTranscriptCount = 0;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const catId = String(v.categoryId || '');
      if (catId && BLACKLIST_CATEGORY_IDS.has(catId)) {
        noTranscriptCount++;
        continue;
      }

      console.log(`  자막 (${i + 1}/${videos.length}): ${v.title.substring(0, 40)}...`);
      const meta = await getTranscriptData(v.videoId);
      if (meta.hasTranscript) {
        v.transcript = meta.transcript;
        v.transcriptItems = meta.transcriptItems;
        withTranscript.push(v);
        if (statusCallback) statusCallback({ transcriptCount: withTranscript.length });
      } else {
        noTranscriptCount++;
      }
    }
    console.log(`[Job][Section3] 자막 있는 후보: ${withTranscript.length}개 (자막없음: ${noTranscriptCount}개)`);

    if (withTranscript.length === 0) {
      return { success: 0, fail: 0, skipped: noTranscriptCount, watchlistTotal: allChannels.length };
    }

    // 일일 한도 적용
    const toAnalyze = withTranscript.slice(0, dailyLimit);
    if (statusCallback) statusCallback({ totalToAnalyze: toAnalyze.length });

    if (section3AbortFlag) {
      console.log(`[Job][Section3] ⏹️ 사용자가 작업을 중단했습니다.`);
      return { success: 0, fail: 0, skipped: 0, aborted: true };
    }

    // 6. 유료 분석
    if (statusCallback) statusCallback({ currentStep: 'LLM 유료 분석 중', analyzingCount: 0 });
    console.log(`\n[Job][Section3] 유료 분석 시작 (${toAnalyze.length}개)...`);
    const results = await analyzeVideos(toAnalyze, options, (progress) => {
      if (statusCallback) statusCallback({ analyzingCount: progress });
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Job][Section3] 완료 — 소요: ${elapsed}초`);
    console.log(`  워치리스트: ${allChannels.length}개 → 서칭: ${channels.length}개 → 수집: ${videos.length}개 → 자막: ${withTranscript.length}개 → 분석: ${toAnalyze.length}개`);
    console.log(`  분석 성공: ${results.success}개 / 실패: ${results.fail}개`);
    if (results.errors?.length > 0) {
      results.errors.forEach(e => console.log(`    - ${e.title}: ${e.error}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return {
      ...results,
      skipped: noTranscriptCount,
      watchlistTotal: allChannels.length,
      searchedChannels: channels.length,
    };
  } catch (err) {
    console.error('[Job][Section3] 치명적 오류:', err);
    return { success: 0, fail: 0, skipped: 0, errors: [{ title: 'fatal', error: err.message }] };
  }
}

module.exports = { runJob, runJobType1, runJobType2, runJobSection2, abortSection2, runJobSection3, abortSection3 };
