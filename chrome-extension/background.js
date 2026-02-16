// 어그로필터 크롬 확장팩 - Background Service Worker
// content script에서 추출한 자막/메타데이터를 저장하고 웹사이트를 열어줍니다.
// 어그로필터 사이트의 inject-transcript.js가 자막 데이터를 가져갑니다.

const SITE_URL = 'https://aggrofilter.netlify.app';

// 최신 자막 데이터 (메모리에 보관, 웹사이트 content script가 가져갈 때까지)
let pendingAnalysisData = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 유튜브 content script → 자막 추출 완료, 웹사이트 열기
  if (message.type === 'ANALYZE_VIDEO') {
    const data = message.data;
    pendingAnalysisData = data;

    console.log(`[어그로필터] 자막 저장: ${data.videoId}, ${data.transcript?.length || 0}자`);

    // 웹사이트 새 탭 열기 (inject-transcript.js가 자동으로 자막 데이터를 주입)
    const analyzeUrl = `${SITE_URL}/?url=${encodeURIComponent(data.url)}&from=chrome-extension`;
    chrome.tabs.create({ url: analyzeUrl });

    sendResponse({ success: true });
    return false;
  }

  // 어그로필터 사이트의 inject-transcript.js → 자막 데이터 요청
  if (message.type === 'GET_TRANSCRIPT_DATA') {
    console.log('[어그로필터] inject-transcript.js에서 자막 데이터 요청');
    const data = pendingAnalysisData;
    pendingAnalysisData = null;
    sendResponse({ success: true, data });
    return false;
  }

  // 사용자 정보 조회
  if (message.type === 'GET_USER') {
    (async () => {
      const result = await chrome.storage.local.get(['userEmail', 'userNickname']);
      sendResponse({ success: true, data: result.userEmail ? result : null });
    })();
    return true;
  }
});
