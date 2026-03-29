const axios = require('axios');
const config = require('./config');

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

// 본진(/api/analysis/request) liveKeywords 차단 규칙 동기화 (Section2 사전 제외용)
const MAIN_APP_LIVE_KEYWORDS = [
  '라이브', '생방송', '생중계', '실시간 방송',
  ' live', '(live)', '[live]',
  'live stream', 'livestream', 'streaming', 'streamer', '스트리밍', '스트리머',
  '다시보기', '풀영상', '전편', '녹화본', '방송분', '(녹)',
  '무대영상', '공연영상', '콘서트', 'fancam', '직캠',
  '하이라이트', '풀 하이라이트', 'highlight', 'highlights',
  ' h/l', '[h/l]', '(h/l)', ' hl ', '[hl]', '(hl)',
  '득점장면', '골장면', '명장면', '주요장면', '전반전', '후반전',
  '모든 골', '전경기', '경기 요약',
  '정주행', '연속보기', '모음집', '모음', '클립', 'clips',
  '실시간', '방송중', '달립시다', '탐방',
  '역대급', '최신판', '멸망전', '대회', '스크림', '내전', '자랭',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 수집 제외 영상 판별 (제목 키워드 기반)
 * - 단순 음악영상(MV), 라이브/생방송, 단순 줄거리 요약/결말, 단순 게임 플레이 제외
 */
function isExcludedVideo(v) {
  const title = (v.snippet.title || '').toLowerCase();
  const categoryId = v.snippet?.categoryId;

  // 1. 카테고리 화이트리스트 기반 필터링 (config.targetCategories에 정의된 ID만 허용)
  const allowedCategoryIds = config.targetCategories.map(c => c.id);
  if (!allowedCategoryIds.includes(categoryId)) {
    return { excluded: true, reason: `not_in_whitelist_category_${categoryId}` };
  }

  // 2. 최소한의 형식적 차단 (음악/라이브 성격의 제목만 차단)
  // 세부적인 '팩트체크 적합성'은 AI가 판단하도록 위임함
  const musicKeywords = [
    ' m/v', '(m/v)', '[m/v]', 'official mv', 'official m/v', '뮤직비디오', 
    'lyric video', 'lyrics', '가사 영상', 'official audio'
  ];
  if (musicKeywords.some(kw => title.includes(kw))) return { excluded: true, reason: 'music_video_format' };

  const liveKeywords = [
    '라이브', '생방송', '실시간 방송', '다시보기', '풀영상', '하이라이트',
    ' live', '(live)', '[live]', 'streaming', '스트리밍'
  ];
  if (liveKeywords.some(kw => title.includes(kw))) return { excluded: true, reason: 'live_format' };

  return { excluded: false };
}

function isLikelyRejectedByMainAppLiveFilter(v) {
  const title = (v?.snippet?.title || '').toLowerCase();
  if (!title) return { rejected: false };

  const matched = MAIN_APP_LIVE_KEYWORDS.find((kw) => title.includes(kw));
  if (!matched) return { rejected: false };

  return { rejected: true, reason: 'main_app_live_filter', matchedKeyword: matched };
}


/**
 * 한국어 영상 여부 확인 (메타데이터 우선, 제목/채널명 보완)
 */
function isKoreanVideo(v) {
  const snippet = v.snippet;
  const defaultLang = (snippet.defaultLanguage || '').toLowerCase();
  const audioLang = (snippet.defaultAudioLanguage || '').toLowerCase();

  // 1. 메타데이터 언어가 한국어가 아닌 다른 언어로 명시된 경우 제외 (ja, en 등)
  if (defaultLang && !defaultLang.startsWith('ko')) return false;
  if (audioLang && !audioLang.startsWith('ko')) return false;

  const title = snippet.title || '';
  const channelTitle = snippet.channelTitle || '';

  // 2. 일본어 문자 감지 (히라가나/가타카나 + 한자 일부)
  // 일본어 전용 문자(히라가나/가타카나)가 하나라도 있으면 해외 영상으로 간주
  const hasJapaneseKana = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(title) || 
                          /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9D]/.test(channelTitle);
  if (hasJapaneseKana) return false;

  // 3. 한글 포함 여부 확인 (한글이 아예 없으면 영어/기타 외국어 영상이므로 제외)
  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(title) || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(channelTitle);
  if (!hasKorean) return false;

  return true;
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
  const videoId = (v.id?.videoId || v.id || '').toString().trim();
  const channelId = (v.snippet?.channelId || '').toString().trim();
  const publishedAt = new Date(v.snippet.publishedAt);
  const now = new Date();
  const diffMs = Math.max(1, now - publishedAt);
  const hours = diffMs / (1000 * 60 * 60);
  const viewCount = parseInt(v.statistics?.viewCount || '0', 10);
  const viewsPerHour = Math.round(viewCount / hours);

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: v.snippet.title,
    channelId,
    channelName: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    viewCount,
    viewsPerHour, // 시간당 조회수(Velocity)
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
  console.log(`\n[Collector][Type1] 전체 인기 트렌드 최대 ${n}개 수집 시작...`);
  // 자막 없음, 필터링 탈락을 대비해 목표의 4배수(최소 20개)를 후보로 확보
  const targetWithBuffer = Math.max(n * 4, 20);
  let pageToken = undefined;
  let fetchedCount = 0;
  const publishedAfter12h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24시간으로 확대

  // 카테고리당 최대 허용 수: 후보군 내 균형을 위해 약간 넉넉히 잡음
  const maxPerCategory = Math.max(5, Math.floor(targetWithBuffer / 5));
  const categoryCount = {}; 
  const candidates = [];
  const maxPerChannel = config.maxPerChannel ?? 2;

  console.log(`  [Type1] 목표 분석 개수: ${n}, 확보할 후보군: ${targetWithBuffer}개`);

  // ── 플랜 A: videos.list mostPopular (상위 300개까지 탐색) ──
  while (fetchedCount < 300 && candidates.length < targetWithBuffer) {
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
        const vId = v.id;
        const title = v.snippet.title;

        if (isShorts(v.contentDetails?.duration)) continue;
        if (new Date(v.snippet.publishedAt) < new Date(publishedAfter12h)) continue; // 24시간 이내
        
        if (recentVideoIds.has(vId)) {
          // console.log(`  [Type1][SKIP-ALREADY] 이미 분석됨: ${title}`);
          continue;
        }
        if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) {
          console.log(`  [Type1][SKIP-COOLDOWN] 채널 쿨타임: ${v.snippet.channelTitle}`);
          continue;
        }
        if (seenVideoIds.has(vId)) continue;
        if (!isKoreanVideo(v)) continue;

        const vc = parseInt(v.statistics?.viewCount || '0', 10);
        if (vc < config.minViewCount) continue;

        if (isExcludedVideo(v).excluded) continue;

        // Type1 (전체 트렌딩)도 핵심 카테고리 7개(22,24,25,26,27,28,29)만 수집하여 무의미한 영상 필터링
        const catId = (v.snippet?.categoryId || '').toString();
        const allowedCategories = ['22', '24', '25', '26', '27', '28', '29'];
        if (!allowedCategories.includes(catId)) continue;

        candidates.push(normalizeVideo(v, 'type1', '전체 트렌드'));
        if (candidates.length >= targetWithBuffer) break;
      }

      pageToken = res.data.nextPageToken;
      fetchedCount += items.length;
      if (!pageToken || fetchedCount >= 300) break;
      await sleep(200);
    } catch (err) {
      console.error('[Collector][Type1][PlanA] 실패:', err.response?.data?.error?.message || err.message);
      break;
    }
  }

  // ── 플랜 B: Fallback (Search) — 인기 차트에서 후보가 부족할 때만 실행 ──
  if (candidates.length < targetWithBuffer) {
    console.log(`  [Type1][PlanB] 플랜A 후보 부족(${candidates.length}/${targetWithBuffer}) -> 검색 보완 시작`);
    try {
      const searchQueries = ['뉴스', '이슈', '논란', '리뷰', '현황', '사건'];
      for (const q of searchQueries) {
        if (candidates.length >= targetWithBuffer) break;

        const searchRes = await axios.get(YT_SEARCH_URL, {
          params: {
            key: config.youtubeApiKey,
            part: 'snippet',
            type: 'video',
            q: q,
            regionCode: 'KR',
            relevanceLanguage: 'ko',
            publishedAfter: publishedAfter12h,
            order: 'viewCount',
            maxResults: 30,
          },
        });

        const rawIds = (searchRes.data.items || []).map(i => i.id.videoId).filter(Boolean);
        if (rawIds.length > 0) {
          const details = await fetchVideoDetails(rawIds);
          const alreadyInCandidates = new Set(candidates.map(v => v.videoId));

          for (const v of details) {
            if (candidates.length >= targetWithBuffer) break;
            if (isShorts(v.contentDetails?.duration)) continue;
            if (recentVideoIds.has(v.id)) continue;
            if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
            if (seenVideoIds.has(v.id) || alreadyInCandidates.has(v.id)) continue;
            if (!isKoreanVideo(v)) continue;

            const vc = parseInt(v.statistics?.viewCount || '0', 10);
            if (vc < Math.max(config.minViewCount, 3000)) continue;

            const excl = isExcludedVideo(v);
            if (excl.excluded) continue;

            candidates.push(normalizeVideo(v, 'type1', `검색:${q}`));
          }
        }
        await sleep(300);
      }
    } catch (err) {
      console.error('[Collector][Type1][PlanB] 실패:', err.response?.data?.error?.message || err.message);
    }
  }

  // [Sort] 시간당 조회수(Velocity) 높은 순 정렬
  candidates.sort((a, b) => b.viewsPerHour - a.viewsPerHour);

  const collected = [];
  const channelCount = {};
  const catCount = {};

  for (const v of candidates) {
    if (collected.length >= targetWithBuffer) break;

    const catId = v.categoryId;
    if ((catCount[catId] || 0) >= maxPerCategory) continue;

    const chId = v.channelId;
    if ((channelCount[chId] || 0) >= maxPerChannel) continue;

    seenVideoIds.add(v.videoId);
    catCount[catId] = (catCount[catId] || 0) + 1;
    channelCount[chId] = (channelCount[chId] || 0) + 1;
    collected.push(v);
    // console.log(`  [Type1][ADD-CANDIDATE] ${v.title} (VPH: ${v.viewsPerHour.toLocaleString()}/h)`);
  }

  console.log(`[Collector][Type1] 총 ${collected.length}개의 후보군 확보 완료 (분석 목표: ${n}개)`);
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
  const FALLBACK_MIN_VPH  = 500; // 완화: 1000→500
  const cutoff12h = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간으로 확대
  const targetWithBuffer = Math.max(m * 3, 5); // 자막 없음 등을 대비해 최소 5개 버퍼 확보

  console.log(`\n[Collector][Type2] 카테고리별 최대 ${m}개(버퍼:${targetWithBuffer}) × ${targetCategories.length}개 카테고리 수집...`);
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
        if (normalized.viewsPerHour < Math.floor(config.minViewsPerHour / 2)) {
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
            } // Fallback VPH: 500

            catCandidates.push(normalized);
          }
          console.log(`    [Type2][PlanB] Fallback 후 후보: ${catCandidates.length}개`);
        }
      } catch (err) {
        console.error(`    [Type2][PlanB] 실패: ${err.response?.data?.error?.message || err.message}`);
      }
    }

    // VPH 내림차순 정렬 후 상위 targetWithBuffer개 선택
    catCandidates.sort((a, b) => b.viewsPerHour - a.viewsPerHour);

    let picked = 0;
    for (const v of catCandidates) {
      if (picked >= targetWithBuffer) break;
      seenVideoIds.add(v.videoId);
      collected.push(v);
      console.log(`    [Type2][OK] ${v.title} (VPH: ${v.viewsPerHour.toLocaleString()}/h)`);
      picked++;
    }

    await sleep(500);
  }

  console.log(`[Collector][Type2] ${collected.length}개 수집 완료`);
  return collected;
}

/**
 * [섹션2] 어그로 키워드 사냥 — 섹션2 핵심
 * DB의 bot_aggro_keywords에서 키워드 그룹을 가져와 각 키워드로 YouTube 검색.
 * 기본 필터링만 수행하고 후보를 모두 반환 (사전 스코어링은 job에서 처리).
 */
async function collectSection2(recentVideoIds, recentChannelMap, seenVideoIds, options = {}) {
  const { getAggroKeywordGroups } = require('./db');

  const kRaw = Number(options.keywordSearchCount ?? options.aggroSearchPerKeyword ?? config.aggroSearchPerKeyword ?? 30);
  const k = Number.isFinite(kRaw) ? Math.max(1, Math.min(50, Math.floor(kRaw))) : 30;
  
  // publishedAfter: 최근 N일 이내 (기본 5일)
  const days = options.publishedAfterDays ?? 5;
  const publishedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const maxPerChannel = config.maxPerChannel ?? 3;

  console.log(`\n[Collector][Section2] 어그로 키워드 사냥 시작 (키워드당 최대 ${k}개)`);
  console.log(`  업로드 범위: 최근 ${days}일 (${new Date(publishedAfter).toLocaleString('ko-KR')} ~ 현재)`);

  // DB에서 활성 키워드 그룹 로드
  let keywordGroups;
  try {
    keywordGroups = await getAggroKeywordGroups(true);
  } catch (err) {
    console.warn('[Collector][Section2] DB 키워드 로드 실패, config 폴백 사용:', err.message);
    keywordGroups = (config.defaultAggroKeywordGroups || []).map(g => ({
      group_name: g.groupName,
      keywords: g.keywords,
    }));
  }

  if (keywordGroups.length === 0) {
    console.log('[Collector][Section2] 활성 키워드 그룹 없음. 스킵.');
    return [];
  }

  const allKeywords = [];
  const seenKeywordSet = new Set();
  for (const group of keywordGroups) {
    const kws = Array.isArray(group.keywords) ? group.keywords : [];
    console.log(`  [Section2] 그룹 "${group.group_name}": ${kws.length}개 키워드`);
    for (const kw of kws) {
      const keyword = String(kw || '').trim();
      if (!keyword) continue;
      const norm = keyword.toLowerCase();
      if (seenKeywordSet.has(norm)) continue;
      seenKeywordSet.add(norm);
      allKeywords.push({ keyword, groupName: group.group_name });
    }
  }

  const candidates = [];
  const channelCount = {};
  let preRejectedByMainApp = 0;

  for (const { keyword, groupName } of allKeywords) {
    try {
      const searchRes = await axios.get(YT_SEARCH_URL, {
        params: {
          key: config.youtubeApiKey,
          part: 'snippet',
          type: 'video',
          q: keyword,
          regionCode: 'KR',
          relevanceLanguage: 'ko',
          publishedAfter,
          order: 'viewCount',
          maxResults: 50,
          videoDuration: 'medium',
        },
      });

      const rawIds = (searchRes.data.items || []).map(i => i.id.videoId).filter(Boolean);
      if (rawIds.length === 0) {
        console.log(`  [Section2] "${keyword}" → 결과 없음`);
        continue;
      }

      const details = await fetchVideoDetails(rawIds);
      let added = 0;

      for (const v of details) {
        if (added >= k) break;
        const vId = v.id;
        if (isShorts(v.contentDetails?.duration)) continue;
        if (recentVideoIds.has(vId)) continue;
        if (seenVideoIds.has(vId)) continue;
        if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
        if (!isKoreanVideo(v)) continue;

        const excl = isExcludedVideo(v);
        if (excl.excluded) continue;

        const mainReject = isLikelyRejectedByMainAppLiveFilter(v);
        if (mainReject.rejected) {
          preRejectedByMainApp++;
          const title = v?.snippet?.title || '';
          console.log(`  [Section2][SKIP-MAIN-LIVE] 키워드="${mainReject.matchedKeyword}" 제목="${title.substring(0, 90)}"`);
          continue;
        }

        const chId = v.snippet.channelId;
        if ((channelCount[chId] || 0) >= maxPerChannel) continue;

        const normalized = normalizeVideo(v, 'section2', `어그로:${groupName}:${keyword}`);
        normalized.keyword = keyword;
        normalized.keywordGroup = groupName;
        candidates.push(normalized);
        seenVideoIds.add(vId);
        channelCount[chId] = (channelCount[chId] || 0) + 1;
        added++;
      }

      console.log(`  [Section2] "${keyword}" → ${rawIds.length}건 검색, ${added}건 후보 추가`);
      await sleep(300);
    } catch (err) {
      console.error(`  [Section2] "${keyword}" 검색 실패:`, err.response?.data?.error?.message || err.message);
    }
  }

  // VPH 내림차순 정렬
  candidates.sort((a, b) => b.viewsPerHour - a.viewsPerHour);

  console.log(`[Collector][Section2] 어그로 키워드 사냥 완료: ${candidates.length}개 후보 확보 (본진 live 필터 사전제외: ${preRejectedByMainApp}개)`);
  return candidates;
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

/**
 * [섹션2] 트렌딩 사냥 — videos.list mostPopular 기반 (쿼터: 카테고리당 1유닛)
 * 키워드 검색(100유닛/키워드)보다 약 100배 쿼터 절약
 */
async function collectSection2Trending(recentVideoIds, recentChannelMap, seenVideoIds, options = {}) {
  const days = options.publishedAfterDays ?? 7;
  const maxPerChannel = config.maxPerChannel ?? 3;
  const publishedAfterCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = [];
  const channelCount = {};

  console.log(`\n[Collector][Section2-Trend] 트렌딩 사냥 시작 (${days}일 이내, ${config.targetCategories.length}개 카테고리)`);

  for (const category of config.targetCategories) {
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
      let added = 0;

      for (const v of items) {
        if (isShorts(v.contentDetails?.duration)) continue;
        if (new Date(v.snippet.publishedAt) < publishedAfterCutoff) continue;
        if (recentVideoIds.has(v.id)) continue;
        if (seenVideoIds.has(v.id)) continue;
        if (isChannelExcluded(recentChannelMap, v.snippet.channelId)) continue;
        if (!isKoreanVideo(v)) continue;

        const excl = isExcludedVideo(v);
        if (excl.excluded) continue;

        const mainReject = isLikelyRejectedByMainAppLiveFilter(v);
        if (mainReject.rejected) continue;

        const chId = v.snippet.channelId;
        if ((channelCount[chId] || 0) >= maxPerChannel) continue;

        const normalized = normalizeVideo(v, 'section2', category.name);
        normalized.keyword = '트렌딩';
        normalized.keywordGroup = '트렌딩';
        candidates.push(normalized);
        seenVideoIds.add(v.id);
        channelCount[chId] = (channelCount[chId] || 0) + 1;
        added++;
      }

      console.log(`  [Section2-Trend] "${category.name}" → ${items.length}건 수신, ${added}건 후보`);
      await sleep(100);
    } catch (err) {
      console.error(`  [Section2-Trend] "${category.name}" 실패:`, err.response?.data?.error?.message || err.message);
    }
  }

  console.log(`[Collector][Section2-Trend] 완료: ${candidates.length}개`);
  return candidates;
}

/**
 * 섹션2 전용 수집 — 키워드 사냥 (트렌딩 제거, 순수 키워드 검색만 수행)
 */
async function collectSection2Only(recentVideoIds, recentChannelMap, options = {}) {
  const seenVideoIds = new Set();

  const keywordResults = await collectSection2(recentVideoIds, recentChannelMap, seenVideoIds, options);

  console.log(`\n[Collector] 섹션2 전용 수집: 순수 키워드 검색 ${keywordResults.length}개`);
  return keywordResults;
}

module.exports = { collectTargetVideos, collectType1Only, collectType2Only, collectSection2, collectSection2Only };
