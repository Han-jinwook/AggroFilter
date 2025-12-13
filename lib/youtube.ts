import { fetchTranscript } from 'youtube-transcript-plus';

export interface VideoInfo {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  description: string;
}

export interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
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

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  console.log('YouTube API 호출 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
  
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    console.error('YouTube API 오류:', JSON.stringify(data, null, 2));
    throw new Error(`YouTube API 오류: ${data.error?.message || response.statusText}`);
  }
  
  if (!data.items || data.items.length === 0) {
    throw new Error('영상 정보를 찾을 수 없습니다.');
  }

  const snippet = data.items[0].snippet;
  
  return {
    videoId,
    title: snippet.title,
    channelName: snippet.channelTitle,
    channelId: snippet.channelId,
    thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
    description: snippet.description,
  };
}

export async function getTranscript(videoId: string): Promise<string> {
  console.log('자막 가져오기 시작:', videoId);
  
  // 방법 1: 한국어 자막 시도
  try {
    console.log('방법1: youtube-transcript-plus (ko)');
    const transcript = await fetchTranscript(videoId, { lang: 'ko' });
    if (transcript && transcript.length > 0) {
      const text = transcript.map(item => item.text).join(' ');
      console.log('자막 성공 (ko):', text.length, '자');
      return text;
    }
  } catch (e: any) {
    console.log('방법1 실패:', e.message?.substring(0, 100));
  }
  
  // 방법 2: 언어 지정 없이
  try {
    console.log('방법2: youtube-transcript-plus (자동)');
    const transcript = await fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      const text = transcript.map(item => item.text).join(' ');
      console.log('자막 성공 (자동):', text.length, '자');
      return text;
    }
  } catch (e: any) {
    console.log('방법2 실패:', e.message?.substring(0, 100));
  }
  
  // 방법 3: 영어 자막 시도
  try {
    console.log('방법3: youtube-transcript-plus (en)');
    const transcript = await fetchTranscript(videoId, { lang: 'en' });
    if (transcript && transcript.length > 0) {
      const text = transcript.map(item => item.text).join(' ');
      console.log('자막 성공 (en):', text.length, '자');
      return text;
    }
  } catch (e: any) {
    console.log('방법3 실패:', e.message?.substring(0, 100));
  }
  
  console.log('모든 자막 방법 실패');
  return '자막을 가져올 수 없습니다.';
}
