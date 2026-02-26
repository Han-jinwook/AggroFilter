/**
 * youtube-meta.js
 * lib/youtube.ts 포팅 — 영상 메타정보 + 자막 수집 (봇 자체 처리)
 */
const axios = require('axios');
const { fetchTranscript } = require('youtube-transcript-plus');
const config = require('./config');

const LANG_MAP = {
  ko: 'korean', en: 'english', ja: 'japanese', zh: 'chinese',
  es: 'spanish', fr: 'french', de: 'german', ru: 'russian',
  pt: 'portuguese', it: 'italian',
};

/**
 * YouTube API로 영상 메타정보 조회
 */
async function getVideoInfo(videoId) {
  const apiKey = config.youtubeApiKey;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다.');

  const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { key: apiKey, part: 'snippet,contentDetails', id: videoId },
    timeout: 15000,
  });
  const items = videoRes.data.items;
  if (!items || items.length === 0) throw new Error('영상 정보를 찾을 수 없습니다.');

  const item = items[0];
  const snippet = item.snippet;
  const channelId = snippet.channelId;
  const officialCategoryId = parseInt(snippet.categoryId || '0', 10);
  const duration = item.contentDetails?.duration || '';

  const defaultLanguage = snippet.defaultLanguage || snippet.defaultAudioLanguage;
  let language;
  if (defaultLanguage) {
    const code = defaultLanguage.toLowerCase().split('-')[0];
    language = LANG_MAP[code] || 'english';
  }

  // 채널 정보
  let channelThumbnailUrl = '';
  let channelHandle = '';
  let subscriberCount = 0;
  try {
    const chRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { key: apiKey, part: 'snippet,statistics', id: channelId },
      timeout: 10000,
    });
    const chItem = chRes.data.items?.[0];
    if (chItem) {
      channelThumbnailUrl = chItem.snippet.thumbnails?.default?.url || '';
      channelHandle = chItem.snippet.customUrl || '';
      subscriberCount = parseInt(chItem.statistics?.subscriberCount || '0', 10);
    }
  } catch (e) {
    console.warn(`[Meta] 채널 정보 조회 실패 (${channelId}):`, e.message);
  }

  return {
    videoId,
    title: snippet.title,
    channelName: snippet.channelTitle,
    channelId,
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.default?.url || '',
    channelThumbnailUrl,
    channelHandle,
    subscriberCount,
    description: snippet.description || '',
    officialCategoryId,
    duration,
    publishedAt: snippet.publishedAt || '',
    language,
  };
}

/**
 * 자막 수집 (youtube-transcript-plus)
 * @returns {{ transcript: string, transcriptItems: Array, hasTranscript: boolean }}
 */
async function getTranscriptData(videoId) {
  try {
    const items = await fetchTranscript(videoId);
    if (items && items.length > 0) {
      const transcript = items.map((it) => it.text).join(' ');
      const transcriptItems = items.map((it) => ({
        text: it.text,
        start: it.offset ?? it.start ?? 0,
        duration: it.duration ?? 0,
      }));
      const hasTranscript = transcript.length > 50;
      console.log(`[Meta] 자막 성공: ${transcript.length}자, ${items.length}줄 (${videoId})`);
      return { transcript, transcriptItems, hasTranscript };
    }
  } catch (e) {
    const isNoTranscript = e.message?.includes('No transcripts') || e.message?.includes('disabled');
    console.log(isNoTranscript
      ? `[Meta] 자막 없는 영상: ${videoId}`
      : `[Meta] 자막 추출 실패 (${videoId}): ${e.message?.substring(0, 100)}`
    );
  }
  return { transcript: '', transcriptItems: [], hasTranscript: false };
}

module.exports = { getVideoInfo, getTranscriptData };
