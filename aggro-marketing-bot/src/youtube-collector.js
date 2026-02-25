const axios = require('axios');
const { youtubeApiKey, maxVideosPerCategory, targetCategories } = require('./config');

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * 특정 카테고리의 최근 12시간 내 한국어 트렌드 영상 수집
 */
async function fetchTrendingVideos(category) {
  const publishedAfter = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  try {
    const searchRes = await axios.get(YT_SEARCH_URL, {
      params: {
        key: youtubeApiKey,
        part: 'snippet',
        type: 'video',
        q: category.keyword,
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        publishedAfter,
        order: 'viewCount',
        maxResults: maxVideosPerCategory * 2, // 중복 필터링 후 maxVideosPerCategory 확보용
        videoDuration: 'medium', // 4~20분 (쇼츠 제외)
      },
    });

    const items = searchRes.data.items || [];
    if (items.length === 0) return [];

    const videoIds = items.map((i) => i.id.videoId).join(',');

    // 상세 정보 (카테고리 ID, 언어 등) 추가 조회
    const detailRes = await axios.get(YT_VIDEOS_URL, {
      params: {
        key: youtubeApiKey,
        part: 'snippet,contentDetails,statistics',
        id: videoIds,
      },
    });

    const details = detailRes.data.items || [];

    return details
      .filter((v) => {
        // 쇼츠 제외 (1분 미만)
        const dur = v.contentDetails?.duration || '';
        if (dur === 'PT0S' || /^PT\d+S$/.test(dur)) return false;
        return true;
      })
      .slice(0, maxVideosPerCategory)
      .map((v) => ({
        videoId: v.id,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelName: v.snippet.channelTitle,
        publishedAt: v.snippet.publishedAt,
        categoryId: category.id,
        categoryName: category.name,
      }));
  } catch (err) {
    console.error(`[Collector] 카테고리 "${category.name}" 수집 실패:`, err.response?.data?.error?.message || err.message);
    return [];
  }
}

/**
 * 전체 카테고리 순회하며 영상 수집
 * 이미 분석된 videoId/channelId는 제외
 */
async function collectTargetVideos(recentVideoIds, recentChannelIds) {
  const collected = [];

  for (const category of targetCategories) {
    console.log(`[Collector] 카테고리 수집 중: ${category.name} (키워드: "${category.keyword}")`);
    const videos = await fetchTrendingVideos(category);

    for (const video of videos) {
      if (recentVideoIds.has(video.videoId)) {
        console.log(`  [SKIP] 이미 분석된 영상: ${video.title}`);
        continue;
      }
      if (recentChannelIds.has(video.channelId)) {
        console.log(`  [SKIP] 최근 분석된 채널: ${video.channelName}`);
        continue;
      }
      collected.push(video);
      console.log(`  [OK] 수집: ${video.title}`);
    }

    // YouTube API quota 보호용 딜레이
    await sleep(1000);
  }

  console.log(`[Collector] 총 ${collected.length}개 영상 수집 완료`);
  return collected;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { collectTargetVideos };
