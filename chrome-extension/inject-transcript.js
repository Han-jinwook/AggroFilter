// 어그로필터 웹사이트에 주입되는 content script
// background에서 보관 중인 자막 데이터를 가져와서 window.postMessage로 전달합니다.
// React가 리스너를 등록하기 전에 메시지가 발생할 수 있으므로 반복 전송합니다.

(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'chrome-extension') return;

  console.log('[어그로필터 확장팩] 자막 데이터 요청 중...');

  let transcriptPayload = null;
  let delivered = false;

  // 웹사이트가 수신 확인하면 반복 전송 중단
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'AGGRO_TRANSCRIPT_RECEIVED') {
      console.log('[어그로필터 확장팩] 웹사이트가 자막 데이터 수신 확인');
      delivered = true;
    }
  });

  function broadcastData() {
    if (delivered) return;
    window.postMessage({ type: 'AGGRO_TRANSCRIPT_DATA', data: transcriptPayload }, '*');
  }

  // background에서 자막 데이터 가져오기
  chrome.runtime.sendMessage({ type: 'GET_TRANSCRIPT_DATA' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[어그로필터 확장팩] 메시지 오류:', chrome.runtime.lastError);
      transcriptPayload = null;
    } else if (response && response.success && response.data) {
      console.log('[어그로필터 확장팩] 자막 데이터 수신:', response.data.transcript?.length || 0, '자');
      transcriptPayload = response.data;
    } else {
      console.log('[어그로필터 확장팩] 자막 데이터 없음');
      transcriptPayload = null;
    }

    // 즉시 1회 전송 + 500ms 간격으로 반복 전송 (최대 15초)
    broadcastData();
    const interval = setInterval(() => {
      if (delivered) { clearInterval(interval); return; }
      broadcastData();
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
    }, 15000);
  });
})();
