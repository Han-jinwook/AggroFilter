/**
 * 유튜브 페이지에서 자막 데이터를 추출하여 서버로 전송하는 스크립트
 */

async function extractAndSendTranscript() {
  console.log('🔍 [AggroFilter] 자막 추출 시도...');

  try {
    // 1. ytInitialPlayerResponse 찾기
    let playerResponse = null;
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('ytInitialPlayerResponse')) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
          playerResponse = JSON.parse(match[1]);
          break;
        }
      }
    }

    if (!playerResponse) {
      console.warn('⚠️ [AggroFilter] playerResponse를 찾을 수 없습니다.');
      return;
    }

    // 2. 자막 트랙 확인
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      console.warn('⚠️ [AggroFilter] 자막 트랙이 없습니다.');
      return;
    }

    // 한국어 우선, 없으면 첫 번째 트랙
    const track = tracks.find(t => t.languageCode === 'ko') || tracks[0];
    console.log('✅ [AggroFilter] 자막 트랙 발견:', track.languageCode);

    // 3. 자막 XML 가져오기
    const res = await fetch(track.baseUrl);
    const xml = await res.text();

    // 4. 텍스트 추출
    const transcript = xml.replace(/<text[^>]*>([^<]*)<\/text>/g, '$1 ')
                          .replace(/&amp;/g, '&')
                          .replace(/&quot;/g, '"')
                          .replace(/&#39;/g, "'")
                          .replace(/<[^>]*>/g, '')
                          .trim();

    if (transcript.length < 50) {
      console.warn('⚠️ [AggroFilter] 자막이 너무 짧습니다.');
      return;
    }

    console.log('✅ [AggroFilter] 자막 추출 성공, 서버로 전송 준비 (', transcript.length, '자)');

    // 5. 서버로 전송 (현재 페이지 URL 포함)
    const videoUrl = window.location.href;
    
    // 서버 전송 로직은 팝업이나 설정된 서버 주소로 전송
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_READY',
      data: {
        url: videoUrl,
        transcript: transcript
      }
    });

  } catch (error) {
    console.error('❌ [AggroFilter] 에러 발생:', error);
  }
}

// 페이지 로드 및 URL 변경 감지
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('watch?v=')) {
      setTimeout(extractAndSendTranscript, 2000);
    }
  }
}).observe(document, {subtree: true, childList: true});

// 첫 로드 시 실행
if (location.href.includes('watch?v=')) {
  setTimeout(extractAndSendTranscript, 2000);
}
