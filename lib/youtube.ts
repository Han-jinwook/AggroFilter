import { fetchTranscript } from 'youtube-transcript-plus';

export interface VideoInfo {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  channelThumbnailUrl: string;
  channelHandle: string;
  subscriberCount: number;
  description: string;
  officialCategoryId: number; // 추가: 유튜브 공식 카테고리 ID
  duration?: string; // 추가: 영상 길이 (ISO 8601 형식)
  publishedAt?: string; // 영상 업로드 날짜 (ISO 8601)
}

export interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

export async function getTranscriptItems(videoId: string): Promise<TranscriptItem[]> {
  console.log('자막 가져오기 시작:', videoId);

  // 1회 시도: 언어 지정 없이 (사용 가능한 자막 자동 선택)
  try {
    const transcript = await fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      console.log('자막 성공:', transcript.length, '줄');
      return transcript as TranscriptItem[];
    }
  } catch (e: any) {
    // 자막이 없는 영상은 정상 케이스
    const isNoTranscript = e.message?.includes('No transcripts are available');
    console.log(isNoTranscript ? '자막 없는 영상' : `자막 추출 실패: ${e.message?.substring(0, 100)}`);
  }

  return [];
}

export function extractVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    throw new Error('YouTube API 키가 설정되지 않았습니다.');
  }

  // 1. 비디오 정보 가져오기
  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  console.log('YouTube API 호출 (Video):', videoUrl.replace(apiKey, 'API_KEY_HIDDEN'));
  
  const videoResponse = await fetch(videoUrl);
  const videoData = await videoResponse.json();

  if (!videoResponse.ok) {
    console.error('YouTube API 오류 (Video):', JSON.stringify(videoData, null, 2));
    throw new Error(`YouTube API 오류: ${videoData.error?.message || videoResponse.statusText}`);
  }
  
  if (!videoData.items || videoData.items.length === 0) {
    throw new Error('영상 정보를 찾을 수 없습니다.');
  }

  const item = videoData.items[0];
  const snippet = item.snippet;
  const contentDetails = item.contentDetails;
  const channelId = snippet.channelId;
  const officialCategoryId = parseInt(snippet.categoryId || '0', 10);
  const duration = contentDetails?.duration || '';

  // 2. 채널 정보 가져오기 (프로필 이미지, 핸들, 구독자 수)
  let channelThumbnailUrl = '';
  let channelHandle = '';
  let subscriberCount = 0;

  try {
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
    console.log('YouTube API 호출 (Channel):', channelUrl.replace(apiKey, 'API_KEY_HIDDEN'));
    
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();

    if (channelResponse.ok && channelData.items && channelData.items.length > 0) {
      const channelItem = channelData.items[0];
      channelThumbnailUrl = channelItem.snippet.thumbnails?.default?.url || '';
      channelHandle = channelItem.snippet.customUrl || ''; // @handle
      subscriberCount = parseInt(channelItem.statistics.subscriberCount || '0', 10);
    }
  } catch (error) {
    console.error('채널 정보 가져오기 실패:', error);
    // 채널 정보 실패해도 비디오 정보는 반환
  }
  
  return {
    videoId,
    title: snippet.title,
    channelName: snippet.channelTitle,
    channelId: channelId,
    thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
    channelThumbnailUrl,
    channelHandle,
    subscriberCount,
    description: snippet.description,
    officialCategoryId,
    duration,
    publishedAt: snippet.publishedAt || '',
  };
}

export async function getTranscript(videoId: string): Promise<string> {
  console.log('자막 가져오기 시작:', videoId);

  const items = await getTranscriptItems(videoId);
  if (items.length > 0) {
    const text = items.map(item => item.text).join(' ');
    console.log('자막 성공:', text.length, '자');
    return text;
  }

  return '자막을 가져올 수 없습니다.';
}
