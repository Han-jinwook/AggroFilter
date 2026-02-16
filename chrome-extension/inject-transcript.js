// 어그로필터 웹사이트에 주입되는 content script
// background에서 보관 중인 자막 데이터를 가져와서 window에 주입합니다.

(function() {
  // ?from=chrome-extension 파라미터가 있을 때만 동작
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'chrome-extension') return;

  console.log('[어그로필터 확장팩] 자막 데이터 요청 중...');

  chrome.runtime.sendMessage({ type: 'GET_TRANSCRIPT_DATA' }, (response) => {
    if (response && response.success && response.data) {
      console.log('[어그로필터 확장팩] 자막 데이터 수신:', response.data.transcript?.length || 0, '자');
      
      // window에 자막 데이터 주입 (페이지 컨텍스트에서 접근 가능하도록 script 태그로 주입)
      const script = document.createElement('script');
      script.textContent = `
        window.__AGGRO_TRANSCRIPT_DATA = ${JSON.stringify(response.data)};
        window.dispatchEvent(new CustomEvent('aggro-transcript-ready'));
      `;
      document.documentElement.appendChild(script);
      script.remove();
    } else {
      console.log('[어그로필터 확장팩] 자막 데이터 없음, 서버 추출로 진행');
      const script = document.createElement('script');
      script.textContent = `window.dispatchEvent(new CustomEvent('aggro-transcript-ready'));`;
      document.documentElement.appendChild(script);
      script.remove();
    }
  });
})();
