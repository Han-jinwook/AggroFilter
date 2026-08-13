import { NextResponse } from 'next/server';
import { extractVideoId } from '@/lib/youtube';

export const runtime = 'nodejs';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL 파라미터가 필요합니다.' }, { status: 400, headers: corsHeaders });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ success: false, error: '유효하지 않은 유튜브 URL입니다.' }, { status: 400, headers: corsHeaders });
    }

    // 1. oEmbed 호출로 채널명 및 채널 URL 획득
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const oembedRes = await fetch(oembedUrl);
    if (!oembedRes.ok) {
      return NextResponse.json({ success: false, error: '유튜브 영상 정보를 찾을 수 없습니다. (oEmbed 실패)' }, { status: 404, headers: corsHeaders });
    }

    const oembedData = await oembedRes.json();
    const channelName = oembedData.author_name;
    const authorUrl = oembedData.author_url; // 예: https://www.youtube.com/@handle

    if (!authorUrl) {
      return NextResponse.json({ success: false, error: 'oEmbed 응답에 채널 URL이 누락되었습니다.' }, { status: 500, headers: corsHeaders });
    }

    // 2. 채널 페이지 HTML 파싱하여 channelId 추출
    const authorRes = await fetch(authorUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!authorRes.ok) {
      return NextResponse.json({ success: false, error: '유튜브 채널 홈을 열 수 없습니다.' }, { status: 500, headers: corsHeaders });
    }

    const html = await authorRes.text();

    // 정규식 매칭을 통해 UC... 채널 ID 추출
    let channelId: string | null = null;

    // og:url 매칭 시도
    const ogUrlMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
    if (ogUrlMatch) {
      channelId = ogUrlMatch[1];
    }

    // externalId 매칭 시도
    if (!channelId) {
      const externalIdMatch = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      if (externalIdMatch) {
        channelId = externalIdMatch[1];
      }
    }

    // channelId 매칭 시도
    if (!channelId) {
      const channelIdMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      if (channelIdMatch) {
        channelId = channelIdMatch[1];
      }
    }

    if (!channelId) {
      return NextResponse.json({ success: false, error: '채널 고유 ID(UC...)를 파싱하지 못했습니다.' }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({
      success: true,
      videoId,
      channelId,
      channelName: channelName || '알 수 없는 채널'
    }, { headers: corsHeaders });

  } catch (err: any) {
    console.error('[API Channel Extract Error]:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500, headers: corsHeaders });
  }
}
