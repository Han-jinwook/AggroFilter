// 어그로필터 크롬 확장팩 - Background Service Worker
// content script에서 추출한 자막/메타데이터로 분석 API를 호출하고,
// analysisId를 받아 웹사이트 퀴즈/결과 페이지로 이동합니다.

const SITE_URL = 'https://aggrofilter.netlify.app';
const API_URL = `${SITE_URL}/api/analysis/request`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_VIDEO') {
    (async () => {
      try {
        const data = message.data;
        const user = await chrome.storage.local.get(['userEmail']);

        console.log(`[어그로필터] 분석 API 호출: ${data.videoId}, 자막: ${data.transcript?.length || 0}자`);

        // 분석 API 호출 (자막 포함)
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: data.url,
            userId: user.userEmail || undefined,
            clientTranscript: data.transcript || undefined,
            clientTranscriptItems: data.transcriptItems || undefined,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `분석 요청 실패 (${response.status})`);
        }

        const result = await response.json();
        const analysisId = result.analysisId;

        console.log(`[어그로필터] 분석 완료: ${analysisId}`);

        // 웹사이트 결과 페이지로 이동 (퀴즈 UX 포함)
        const resultUrl = `${SITE_URL}/?analysisId=${analysisId}&from=chrome-extension`;
        chrome.tabs.create({ url: resultUrl });

        // content script에 완료 알림
        sendResponse({ success: true, analysisId });
      } catch (error) {
        console.error('[어그로필터] 분석 오류:', error);
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
