// main world에서 실행되는 스크립트 (유튜브 페이지의 JS 객체에 직접 접근 가능)
// CSP 제한 없이 window.ytInitialPlayerResponse, movie_player 등에 접근합니다.

(function() {
  'use strict';

  // content script(isolated world)에서 요청이 오면 데이터를 반환
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'AGGRO_MAIN_WORLD_REQUEST') return;

    const { requestId, action } = event.data;

    let result = null;

    try {
      if (action === 'GET_CAPTION_TRACKS') {
        // 방법 A: movie_player.getPlayerResponse()
        const player = document.getElementById('movie_player');
        if (player && typeof player.getPlayerResponse === 'function') {
          const resp = player.getPlayerResponse();
          const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            console.log('[어그로필터 main-world] movie_player 자막 트랙:', JSON.stringify(tracks.map(t => ({
              lang: t.languageCode, kind: t.kind, url: t.baseUrl?.substring(0, 200),
              vssId: t.vssId, name: t.name?.simpleText,
            }))));
            result = { source: 'movie_player', tracks: tracks.map(t => ({
              languageCode: t.languageCode,
              baseUrl: t.baseUrl,
              name: t.name?.simpleText || t.languageCode,
              kind: t.kind || '',
              vssId: t.vssId || '',
            }))};
          }
        }

        // 방법 B: ytInitialPlayerResponse (폴백)
        if (!result && window.ytInitialPlayerResponse) {
          const tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            console.log('[어그로필터 main-world] ytInitialPlayerResponse 자막 트랙:', JSON.stringify(tracks.map(t => ({
              lang: t.languageCode, kind: t.kind, url: t.baseUrl?.substring(0, 200),
              vssId: t.vssId, name: t.name?.simpleText,
            }))));
            result = { source: 'ytInitialPlayerResponse', tracks: tracks.map(t => ({
              languageCode: t.languageCode,
              baseUrl: t.baseUrl,
              name: t.name?.simpleText || t.languageCode,
              kind: t.kind || '',
              vssId: t.vssId || '',
            }))};
          }
        }
      }

      if (action === 'GET_YTCFG') {
        if (typeof ytcfg !== 'undefined' && ytcfg.get) {
          result = {
            apiKey: ytcfg.get('INNERTUBE_API_KEY'),
            clientName: ytcfg.get('INNERTUBE_CLIENT_NAME'),
            clientVersion: ytcfg.get('INNERTUBE_CLIENT_VERSION'),
          };
        }
      }
    } catch (e) {
      console.error('[어그로필터 main-world] 오류:', e);
    }

    window.postMessage({
      type: 'AGGRO_MAIN_WORLD_RESPONSE',
      requestId: requestId,
      payload: result,
    }, '*');
  });

  console.log('[어그로필터 main-world] 로드 완료');
})();
