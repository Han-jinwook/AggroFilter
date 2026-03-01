const axios = require('axios');
const config = require('./config');

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 수집 제외 영상 판별 (제목 키워드 기반)
 * - 단순 음악영상(MV), 라이브/생방송, 단순 줄거리 요약/결말, 단순 게임 플레이 제외
 * - 게임 리뷰/비평/분석은 분석 대상 (카테고리만으로 차단 금지)
 */
function isExcludedVideo(v) {
  const title = (v.snippet.title || '').toLowerCase();
  const categoryId = v.snippet?.categoryId;

  // 1. 단순 음악 영상 (MV, Official 등)
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
  if (musicKeywords.some(kw => title.includes(kw))) return { excluded: true, reason: 'music_video' };

  // 2. 라이브/생방송 (게임 라이브, 방송 다시보기 등)
  const liveKeywords = [
    '라이브', '생방송', '생중계', '실시간 방송',
    ' live', '(live)', '[live]',
    'live stream', 'livestream',
    '다시보기', '풀영상', '전편',
  ];
  if (liveKeywords.some(kw => title.includes(kw))) return { excluded: true, reason: 'live_stream' };

  // 3. 단순 줄거리 요약/결말 (논평 없이 내용만 압축)
  const summaryKeywords = [
    '줄거리 요약', '내용 요약', '줄거리 정리',
    '결말 정리', '결말 요약', '결말 포함',
    '스토리 요약', '내용 정리', '편 요약',
    '몰아보기', '모든 내용', '전체 줄거리',
  ];
  if (summaryKeywords.some(kw => title.includes(kw))) return { excluded: true, reason: 'summary_only' };

  // 4. 단순 콘텐츠 재생 (카테고리 + 키워드 조합, 논평/리뷰 키워드 있으면 통과)
  // 공통 로직: [A] 단순 재생 키워드가 있고 [B] 논평/리뷰 키워드가 없으면 제외
  const reviewKeywords = [
    '리뷰', '분석', '비판', '논란', '문제', '평가',
    '추천', '비교', '역대', '최고', '최악', '랭킹',
    '해설', '이유', '이유', '논평', '의미', '시사',
  ];
  const hasReviewKw = reviewKeywords.some(kw => title.includes(kw));

  // 게임(20): 단순 플레이 키워드
  if (categoryId === '20') {
    const gamePlayKeywords = [
      '플레이', 'gameplay', 'game play',
      '풀게임', '풀플레이',
      '솔로랭크', '솔랭', '칼바람', '배틀그라운드',
      '클리어', '엔딩', '공략',
    ];
    if (gamePlayKeywords.some(kw => title.includes(kw)) && !hasReviewKw)
      return { excluded: true, reason: 'game_play' };
  }

  // 스포츠(17): 단순 경기 중계/풀매치
  if (categoryId === '17') {
    const sportsPlayKeywords = [
      '풀게임', '풀매치', '전리플', '실제경기',
      '높라이트', 'full match', 'full game',
      '중계', '직캐스트', '라이브 중계',
    ];
    if (sportsPlayKeywords.some(kw => title.includes(kw)) && !hasReviewKw)
      return { excluded: true, reason: 'sports_broadcast' };
  }

  // 필름/애니(1): 단순 영화/드라마 재생
  if (categoryId === '1') {
    const filmPlayKeywords = [
      '전편 보기', '풀버전', '전편 스트림',
      'full movie', 'full film', 'full episode',
      '전편보기', '전체 보기',
    ];
    if (filmPlayKeywords.some(kw => title.includes(kw)) && !hasReviewKw)
      return { excluded: true, reason: 'film_replay' };
  }

  // 엔터테인먼트(24): 공연/콘서트 단순 재생
  if (categoryId === '24') {
    const entertainPlayKeywords = [
      '콘서트 영상', '콘서트 전편', '전체 공연',
      'full concert', 'full performance', 'full show',
      '공연 영상', '공연 전편',
    ];
    if (entertainPlayKeywords.some(kw => title.includes(kw)) && !hasReviewKw)
      return { excluded: true, reason: 'concert_replay' };
  }

  return { excluded: false };
}

/**
 * 한국어 영상 여부 확인 (메타데이터 우선, 제목/채널명 보완)
 */
function isKoreanVideo(v) {
  const snippet = v.snippet;
  const lang = (snippet.defaultLanguage || snippet.defaultAudioLanguage || '').toLowerCase();

  // 1. 메타데이터에 한국어 설정이 있으면 즉시 승인
  if (lang.startsWith('ko')) return true;

  // 2. 메타데이터가 없거나 다른 언어인 경우 (한국 채널도 메타데이터 누락 잦음)
  // 제목이나 채널명에 한글이 한 글자라도 있으면 승인
  if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(snippet.title) || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(snippet.channelTitle)) {
    return true;
  }

  return false;
}

/**
 * 쇼츠 여부 판별 (1분 미만 제외)
 */
function isShorts(duration) {
  if (!duration || duration === 'PT0S') return true;
  if (/^PT\d+S$/.test(duration)) return true; // PT45S 등 분 단위 없음
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  return h === 0 && m < 1;
}

/**
 * videoIds 배열로 상세 정보 조회
 */
async function fetchVideoDetails(videoIds) {
  if (videoIds.length === 0) return [];
  try {
    const res = await axios.get(YT_VIDEOS_URL, {
      params: {
        key: config.youtubeApiKey,
        part: 'snippet,contentDetails,statistics',
        id: videoIds.join(','),
      },
    });
    return res.data.items || [];
  } catch (err) {
    console.error('[Collector] 상세정보 조회 실패:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

/**
 * 원시 검색 결과를 정규화된 영상 객체로 변환
 */
function normalizeVideo(v, trackType, categoryName) {
  const publishedAt = new Date(v.snippet.publishedAt);
  const now = new Date();
  const diffMs = Math.max(1, now - publishedAt);
  const hours = diffMs / (1000 * 60 * 60);
  const viewCount = parseInt(v.statistics?.viewCount || '0', 10);
  const viewsPerHour = Math.round(viewCount / hours);

  return {
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelName: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    viewCount,
    viewsPerHour, // 시간당 조회수 (Velocity)
    categoryId: v.snippet?.categoryId || 'unknown',
    categoryName: categoryName || v.snippet?.categoryId || '기타',
    trackType, // 'type1' | 'type2'
  };
}

/**
 * recentChannelMap: Map<channelId, reason> 또는 Set<channelId> 모두 지원
 */
function isChannelExcluded(recentChannelMap, channelId) {
  if (recentChannelMap instanceof Map) return recentChannelMap.has(channelId);
  return recentChannelMap.has(channelId);
}

/**
 * [Type1] 전체 트렌드 상위 N개 수집
 * YouTube mostPopular chart 기준 (regionCode: KR)
 */
async function collectType1(n, recentVideoIds, recentChannelMap, seenVideoIds) {
  console.log(`\n[Collector][Type1] 전체 인기 트렌드 최대 ${n}개 수집...`);
  let pageToken = undefined;
  let fetched = 0;
  const publishedAfter12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  // 카테고리당 최대 허용 수: N/10 * 2, 최소 2개
  const maxPerCategory = Math.max(2, Math.floor(n / 10) * 2);
  const categoryCount = {}; // categoryId → 수집 수
  console.log(`  [Type1] 카테고리당 최대 ${maxPerCategory}개 제한 (N=${n})`);

  const candidates = [];

  while (fetched < 150) { // 트렌드 상위 150개 후보군 확보
    try {
      const res = await axios.get(YT_VIDEOS_URL, {
        params: {
          key: config.youtubeApiKey,
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          regionCode: 'KR',
          hl: 'ko',
          maxResults: 50,
          pageToken,
        },
      });

      const items = res.data.items || [];
      for (const v of items) {
        if (isShorts(v.contentDetails?.duration)) continue;
        if (new Date(v.snippet.publishedAt) < new Date(publishedAfter12h)) continue;
        if (recentVideoIds.has(v.id)) continue;
        if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
        if (seenVideoIds.has(v.id)) continue;

        // [Filter] 한국어 필터: 메타데이터 또는 한글 포함 여부 확인
        if (!isKoreanVideo(v)) continue;

        // [Filter] 최소 조회수 하한
        const vc1 = parseInt(v.statistics?.viewCount || '0', 10);
        if (vc1 < config.minViewCount) {
          console.log(`  [Type1][SKIP-MINVIEW] 조회수 부족(${vc1}): ${v.snippet.title}`);
          continue;
        }

        // [Filter] 음악 필터: 분석 변별력이 없는 단순 음악 영상 제외
        const excl1 = isExcludedVideo(v);
        if (excl1.excluded) {
          console.log(`  [Type1][SKIP-${excl1.reason.toUpperCase()}] 제외: ${v.snippet.title}`);
          continue;
        }

        candidates.push(normalizeVideo(v, 'type1', '전체 트렌드'));
      }

      pageToken = res.data.nextPageToken;
      fetched += items.length;
      if (!pageToken || fetched >= 150) break;
      await sleep(300);
    } catch (err) {
      console.error('[Collector][Type1] 실패:', err.response?.data?.error?.message || err.message);
      break;
    }
  }

  // [Sort] 시간당 조회수(Velocity) 높은 순 정렬
  candidates.sort((a, b) => b.viewsPerHour - a.viewsPerHour);

  const collected = [];
  for (const v of candidates) {
    if (collected.length >= n) break;
    
    // 카테고리당 최대 개수 초과 시 스킵 (트렌드 균형 유지)
    const catId = v.categoryId;
    if ((categoryCount[catId] || 0) >= maxPerCategory) {
      console.log(`  [Type1][SKIP-CAT] 카테고리(${catId}) ${maxPerCategory}개 초과 (Velocity 순위는 높으나 균형을 위해 스킵): ${v.title}`);
      continue;
    }

    seenVideoIds.add(v.videoId);
    categoryCount[catId] = (categoryCount[catId] || 0) + 1;
    collected.push(v);
    console.log(`  [Type1][OK] ${v.title} (조회수: ${v.viewCount.toLocaleString()}, 시간당: ${v.viewsPerHour.toLocaleString()}/h)`);
  }

  console.log(`[Collector][Type1] ${collected.length}개 수집 완료`);
  return collected;
}

/**
 * [Type2] 카테고리별 한국 인기 트렌드 상위 M개 수집
 *
 * [플랜 A] videos.list(chart=mostPopular, videoCategoryId) → 메모리에서 12시간 필터
 *   - search.list 없이 진짜 한국 카테고리 트렌드를 1쿼터로 정확하게 가져옴
 *   - 50개를 풀로 가져온 뒤 publishedAt 12시간 이내만 남김
 *
 * [플랜 B] Fallback: 플랜 A 결과가 m개 미달 시 search.list 보완
 *   - minViewCount=10,000 이상 + VPH >= 1,000 이상만 허용
 *   - maxResults=50으로 최대 긁어온 뒤 fetchVideoDetails → VPH 내림차순 → M개 선택
 */
async function collectType2(m, recentVideoIds, recentChannelMap, seenVideoIds, options = {}) {
  const { targetCategories } = config;
  const categoryCooldowns = options.categoryCooldowns || {};
  const FALLBACK_MIN_VIEW = 10000;
  const FALLBACK_MIN_VPH  = 1000;
  const cutoff12h = new Date(Date.now() - 12 * 60 * 60 * 1000);

  console.log(`\n[Collector][Type2] 카테고리별 최대 ${m}개 × ${targetCategories.length}개 카테고리 수집...`);
  if (Object.keys(categoryCooldowns).length > 0) {
    console.log(`  [Type2] 카테고리 쿨타임 설정:`, JSON.stringify(categoryCooldowns));
  }

  const collected = [];

  for (const category of targetCategories) {
    console.log(`  [Type2] 카테고리: ${category.name} (ID: ${category.id})`);
    const catCooldown = categoryCooldowns[category.id] || categoryCooldowns[category.name] || 0;
    if (catCooldown > 0) {
      console.log(`  [Type2][COOLDOWN] 카테고리 쿨타임 ${catCooldown}회 남음, 스킵: ${category.name}`);
      continue;
    }

    let catCandidates = [];

    // ── 플랜 A: videos.list mostPopular + videoCategoryId ──
    try {
      const res = await axios.get(YT_VIDEOS_URL, {
        params: {
          key: config.youtubeApiKey,
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          regionCode: 'KR',
          videoCategoryId: category.id,
          maxResults: 50,
          hl: 'ko',
        },
      });

      const items = res.data.items || [];
      console.log(`    [Type2][PlanA] ${items.length}개 수신 (카테고리: ${category.name})`);

      for (const v of items) {
        if (isShorts(v.contentDetails?.duration)) continue;
        // 12시간 이내 메모리 필터
        if (new Date(v.snippet.publishedAt) < cutoff12h) continue;
        if (recentVideoIds.has(v.id)) continue;
        if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
        if (seenVideoIds.has(v.id)) continue;
        if (!isKoreanVideo(v)) continue;

        const excl = isExcludedVideo(v);
        if (excl.excluded) {
          console.log(`    [Type2][SKIP-${excl.reason.toUpperCase()}] ${v.snippet.title}`);
          continue;
        }

        const normalized = normalizeVideo(v, 'type2', category.name);
        if (normalized.viewsPerHour < config.minViewsPerHour) {
          console.log(`    [Type2][PlanA][SKIP-VPH] VPH 부족(${normalized.viewsPerHour}/h): ${v.snippet.title}`);
          continue;
        }

        catCandidates.push(normalized);
      }
      console.log(`    [Type2][PlanA] 12시간 필터 후 후보: ${catCandidates.length}개`);
    } catch (err) {
      console.error(`    [Type2][PlanA] 실패: ${err.response?.data?.error?.message || err.message}`);
    }

    // ── 플랜 B: Fallback — 플랜 A 결과 m개 미달 시 search.list 보완 ──
    if (catCandidates.length < m) {
      console.log(`    [Type2][PlanB] 플랜A 부족(${catCandidates.length}/${m}) → search.list Fallback 시작`);
      try {
        const publishedAfter = cutoff12h.toISOString();
        const searchRes = await axios.get(YT_SEARCH_URL, {
          params: {
            key: config.youtubeApiKey,
            part: 'snippet',
            type: 'video',
            q: category.keyword,
            regionCode: 'KR',
            relevanceLanguage: 'ko',
            publishedAfter,
            order: 'viewCount',
            maxResults: 50,
            videoDuration: 'medium',
          },
        });

        const rawIds = (searchRes.data.items || []).map((i) => i.id.videoId).filter(Boolean);
        if (rawIds.length > 0) {
          const details = await fetchVideoDetails(rawIds);
          const seenInPlanA = new Set(catCandidates.map((v) => v.videoId));

          for (const v of details) {
            if (isShorts(v.contentDetails?.duration)) continue;
            if (recentVideoIds.has(v.id)) continue;
            if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
            if (seenVideoIds.has(v.id)) continue;
            if (seenInPlanA.has(v.id)) continue;
            if (!isKoreanVideo(v)) continue;

            const vc = parseInt(v.statistics?.viewCount || '0', 10);
            if (vc < FALLBACK_MIN_VIEW) {
              console.log(`    [Type2][PlanB][SKIP-MINVIEW] 조회수 부족(${vc.toLocaleString()}): ${v.snippet.title}`);
              continue;
            }

            const excl = isExcludedVideo(v);
            if (excl.excluded) {
              console.log(`    [Type2][PlanB][SKIP-${excl.reason.toUpperCase()}] ${v.snippet.title}`);
              continue;
            }

            const normalized = normalizeVideo(v, 'type2', category.name);
            if (normalized.viewsPerHour < FALLBACK_MIN_VPH) {
              console.log(`    [Type2][PlanB][SKIP-VPH] VPH 부족(${normalized.viewsPerHour}/h): ${v.snippet.title}`);
              continue;
            }

            catCandidates.push(normalized);
          }
          console.log(`    [Type2][PlanB] Fallback 후 후보: ${catCandidates.length}개`);
        }
      } catch (err) {
        console.error(`    [Type2][PlanB] 실패: ${err.response?.data?.error?.message || err.message}`);
      }
    }

    // VPH 내림차순 정렬 후 상위 M개 선택
    catCandidates.sort((a, b) => b.viewsPerHour - a.viewsPerHour);

    let picked = 0;
    for (const v of catCandidates) {
      if (picked >= m) break;
      seenVideoIds.add(v.videoId);
      collected.push(v);
      console.log(`    [Type2][OK] ${v.title} (조회수: ${v.viewCount.toLocaleString()}, VPH: ${v.viewsPerHour.toLocaleString()}/h)`);
      picked++;
    }

    await sleep(500);
  }

  console.log(`[Collector][Type2] ${collected.length}개 수집 완료`);
  return collected;
}

/**
 * 2-Track 전체 수집 (Type1 + Type2, 중복 제거 포함)
 */
async function collectTargetVideos(recentVideoIds, recentChannelMap, options = {}) {
  const n = options.trackNTotal ?? config.trackNTotal;
  const m = options.trackMPerCategory ?? config.trackMPerCategory;

  const seenVideoIds = new Set(); // Type1/Type2 간 중복 방지

  const [type1, type2] = await Promise.all([
    collectType1(n, recentVideoIds, recentChannelMap, seenVideoIds),
    // Type2는 Type1 완료 후 실행 (seenVideoIds 공유)
  ]).then(async ([t1]) => {
    const t2 = await collectType2(m, recentVideoIds, recentChannelMap, seenVideoIds, options);
    return [t1, t2];
  });

  const all = [...type1, ...type2];
  console.log(`\n[Collector] 2-Track 총 수집: Type1=${type1.length}개, Type2=${type2.length}개, 합계=${all.length}개`);
  return all;
}

/**
 * Type1 전용 수집 (수동 실행용)
 */
async function collectType1Only(recentVideoIds, recentChannelMap, options = {}) {
  const n = options.trackNTotal ?? config.trackNTotal;
  const seenVideoIds = new Set();
  const type1 = await collectType1(n, recentVideoIds, recentChannelMap, seenVideoIds);
  console.log(`\n[Collector] Type1 전용 수집: ${type1.length}개`);
  return type1;
}

/**
 * Type2 전용 수집 (수동 실행용)
 */
async function collectType2Only(recentVideoIds, recentChannelMap, options = {}) {
  const m = options.trackMPerCategory ?? config.trackMPerCategory;
  const seenVideoIds = new Set();
  const type2 = await collectType2(m, recentVideoIds, recentChannelMap, seenVideoIds, options);
  console.log(`\n[Collector] Type2 전용 수집: ${type2.length}개`);
  return type2;
}

module.exports = { collectTargetVideos, collectType1Only, collectType2Only };
