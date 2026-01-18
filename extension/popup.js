let currentData = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TRANSCRIPT_READY') {
    currentData = message.data;
    document.getElementById('status').innerText = '✅ 자막 준비 완료!';
    document.getElementById('analyzeBtn').disabled = false;
  }
});

document.getElementById('analyzeBtn').addEventListener('click', () => {
  if (currentData) {
    // 분석 페이지로 이동하며 자막 데이터를 스토리지에 임시 저장하거나 쿼리 파라미터로 전달
    // 여기서는 PWA 사이트로 이동시키고, 스토리지에 저장하여 PWA가 읽어가게 함
    const targetUrl = `https://aggro-filter.netlify.app/?url=${encodeURIComponent(currentData.url)}`;
    
    // 세션 스토리지 대신 로컬 스토리지에 저장 (PWA와 도메인이 달라 직접 접근은 불가하므로, 
    // 서버로 먼저 전송하고 ID를 받아 이동하는 것이 정석)
    
    // 우선 서버로 자막을 먼저 쏴주고 결과 페이지로 리다이렉트 시도
    document.getElementById('status').innerText = '🚀 서버로 전송 중...';
    
    fetch('https://aggro-filter.netlify.app/api/analysis/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentData.url,
        transcript: currentData.transcript
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.analysisId) {
        chrome.tabs.create({ url: `https://aggro-filter.netlify.app/analysis/${result.analysisId}` });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    })
    .catch(err => {
      console.error(err);
      chrome.tabs.create({ url: targetUrl });
    });
  }
});

// 현재 탭 정보 다시 확인 요청
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (tabs[0]?.url?.includes('watch?v=')) {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ['content.js']
    });
  }
});
