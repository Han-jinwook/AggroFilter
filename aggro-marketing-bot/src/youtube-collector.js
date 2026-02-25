const axios = require('axios');
const config = require('./config');

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return {
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelName: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    viewCount: parseInt(v.statistics?.viewCount || '0', 10),
    categoryName: categoryName || v.snippet?.categoryId || '기타',
    trackType, // 'type1' | 'type2'
  };
}

/**
 * [Type1] 전체 트렌드 상위 N개 수집
 * YouTube mostPopular chart 기준 (regionCode: KR)
 */
async function collectType1(n, recentVideoIds, recentChannelIds, seenVideoIds) {
  console.log(`\n[Collector][Type1] 전체 인기 트렌드 최대 ${n}개 수집...`);
  const collected = [];
  let pageToken = undefined;
  let fetched = 0;

  while (collected.length < n) {
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
        if (collected.length >= n) break;
        if (isShorts(v.contentDetails?.duration)) continue;
        if (recentVideoIds.has(v.id)) continue;
        if (recentChannelIds.has(v.snippet.channelId)) continue;
        if (seenVideoIds.has(v.id)) continue;
        seenVideoIds.add(v.id);
        collected.push(normalizeVideo(v, 'type1', '전체 트렌드'));
        console.log(`  [Type1][OK] ${v.snippet.title}`);
      }

      pageToken = res.data.nextPageToken;
      fetched += items.length;
      if (!pageToken || fetched >= 200) break;
      await sleep(500);
    } catch (err) {
      console.error('[Collector][Type1] 실패:', err.response?.data?.error?.message || err.message);
      break;
    }
  }

  console.log(`[Collector][Type1] ${collected.length}개 수집 완료`);
  return collected;
}

/**
 * [Type2] 카테고리별 최고 조회수 상위 M개 수집
 */
async function collectType2(m, recentVideoIds, recentChannelIds, seenVideoIds) {
  const { targetCategories } = config;
  console.log(`\n[Collector][Type2] 카테고리별 최대 ${m}개 × ${targetCategories.length}개 카테고리 수집...`);
  const collected = [];
  const publishedAfter = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  for (const category of targetCategories) {
    console.log(`  [Type2] 카테고리: ${category.name} (키워드: "${category.keyword}")`);
    try {
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
          maxResults: m * 3,
          videoDuration: 'medium',
        },
      });

      const rawIds = (searchRes.data.items || []).map((i) => i.id.videoId);
      if (rawIds.length === 0) { await sleep(500); continue; }

      const details = await fetchVideoDetails(rawIds);
      let count = 0;

      for (const v of details) {
        if (count >= m) break;
        if (isShorts(v.contentDetails?.duration)) continue;
        if (recentVideoIds.has(v.id)) continue;
        if (recentChannelIds.has(v.snippet.channelId)) continue;
        if (seenVideoIds.has(v.id)) continue;
        seenVideoIds.add(v.id);
        collected.push(normalizeVideo(v, 'type2', category.name));
        console.log(`    [Type2][OK] ${v.snippet.title}`);
        count++;
      }
    } catch (err) {
      console.error(`  [Type2] "${category.name}" 실패:`, err.response?.data?.error?.message || err.message);
    }
    await sleep(800);
  }

  console.log(`[Collector][Type2] ${collected.length}개 수집 완료`);
  return collected;
}

/**
 * 2-Track 전체 수집 (Type1 + Type2, 중복 제거 포함)
 */
async function collectTargetVideos(recentVideoIds, recentChannelIds, options = {}) {
  const n = options.trackNTotal ?? config.trackNTotal;
  const m = options.trackMPerCategory ?? config.trackMPerCategory;

  const seenVideoIds = new Set(); // Type1/Type2 간 중복 방지

  const [type1, type2] = await Promise.all([
    collectType1(n, recentVideoIds, recentChannelIds, seenVideoIds),
    // Type2는 Type1 완료 후 실행 (seenVideoIds 공유)
  ]).then(async ([t1]) => {
    const t2 = await collectType2(m, recentVideoIds, recentChannelIds, seenVideoIds);
    return [t1, t2];
  });

  const all = [...type1, ...type2];
  console.log(`\n[Collector] 2-Track 총 수집: Type1=${type1.length}개, Type2=${type2.length}개, 합계=${all.length}개`);
  return all;
}

module.exports = { collectTargetVideos };
