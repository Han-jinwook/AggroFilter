// 어그로필터 크롬 확장팩 - Background Service Worker
// content script에서 추출한 자막/메타데이터를 저장하고 웹사이트를 열어줍니다.
// 웹사이트가 externally_connectable을 통해 자막 데이터를 가져갑니다.

const SITE_URL = 'https://aggrofilter.netlify.app';

// 최신 자막 데이터 (메모리에 보관, 웹사이트가 가져갈 때까지)
let pendingAnalysisData = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // content script → 자막 추출 완료, 웹사이트 열기
  if (message.type === 'ANALYZE_VIDEO') {
    (async () => {
      try {
        const data = message.data;
        pendingAnalysisData = data;

        console.log(`[어그로필터] 자막 저장 완료: ${data.videoId}, ${data.transcript?.length || 0}자`);

        // 웹사이트 새 탭 열기
        const analyzeUrl = `${SITE_URL}/?url=${encodeURIComponent(data.url)}&from=chrome-extension`;
        const tab = await chrome.tabs.create({ url: analyzeUrl });

        // 탭 로드 완료 후 자막 데이터를 window에 주입
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (transcriptData) => {
                window.__AGGRO_TRANSCRIPT_DATA = transcriptData;
                window.dispatchEvent(new CustomEvent('aggro-transcript-ready'));
              },
              args: [data],
            }).catch(err => console.error('[어그로필터] 스크립트 주입 실패:', err));
          }
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error('[어그로필터] 오류:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
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

// 웹사이트(externally_connectable)에서 자막 데이터 요청
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TRANSCRIPT_DATA') {
    console.log('[어그로필터] 웹사이트에서 자막 데이터 요청');
    const data = pendingAnalysisData;
    pendingAnalysisData = null; // 한 번 전달 후 삭제
    sendResponse({ success: true, data });
    return false;
  }
});
