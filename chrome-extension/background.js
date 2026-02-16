// 어그로필터 크롬 확장팩 - Background Service Worker

const API_BASE_URL = 'https://aggrofilter.netlify.app';

// 저장된 사용자 정보 가져오기
async function getUser() {
  const result = await chrome.storage.local.get(['userEmail', 'userNickname']);
  return result.userEmail ? result : null;
}

// 분석 요청
async function requestAnalysis(videoUrl, userEmail) {
  const response = await fetch(`${API_BASE_URL}/api/analysis/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: videoUrl,
      userId: userEmail || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `분석 요청 실패 (${response.status})`);
  }

  return response.json();
}

// 분석 결과 조회
async function getAnalysisResult(analysisId, userEmail) {
  const url = `${API_BASE_URL}/api/analysis/result/${analysisId}${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('분석 결과를 불러올 수 없습니다.');
  }

  return response.json();
}

// content script → background 메시지 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_VIDEO') {
    (async () => {
      try {
        const user = await getUser();
        const result = await requestAnalysis(message.videoUrl, user?.userEmail);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // async sendResponse
  }

  if (message.type === 'GET_RESULT') {
    (async () => {
      try {
        const user = await getUser();
        const result = await getAnalysisResult(message.analysisId, user?.userEmail);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'GET_USER') {
    (async () => {
      const user = await getUser();
      sendResponse({ success: true, data: user });
    })();
    return true;
  }

  if (message.type === 'OPEN_RESULT_PAGE') {
    const resultUrl = `${API_BASE_URL}/p-result?id=${message.analysisId}`;
    chrome.tabs.create({ url: resultUrl });
    sendResponse({ success: true });
    return false;
  }
});
