// 어그로필터 크롬 확장팩 - Background Service Worker
// 확장팩은 유튜브 URL을 어그로필터 웹사이트로 전달하는 역할만 합니다.

const SITE_URL = 'https://aggrofilter.netlify.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 유튜브 영상 → 어그로필터 웹사이트에서 분석 진행
  if (message.type === 'ANALYZE_VIDEO') {
    const analyzeUrl = `${SITE_URL}/?url=${encodeURIComponent(message.videoUrl)}&from=chrome-extension`;
    chrome.tabs.create({ url: analyzeUrl });
    sendResponse({ success: true });
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
