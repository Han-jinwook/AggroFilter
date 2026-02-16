// main world에서 실행되는 스크립트 (유튜브 페이지의 JS 객체에 직접 접근 가능)
// CSP 제한 없이 window.ytInitialPlayerResponse, movie_player 등에 접근합니다.

(function() {
  'use strict';

  // content script(isolated world)에서 요청이 오면 데이터를 반환
  window.addEventListener('message', async (event) => {
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

      if (action === 'GET_PLAYER_SUBTITLE_DATA') {
        // movie_player에서 이미 로드된 자막 데이터 직접 추출
        const player = document.getElementById('movie_player');
        if (player) {
          // 플레이어의 자막 관련 메서드 탐색
          const methods = [];
          for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(player))) {
            if (typeof player[key] === 'function' && 
                (key.toLowerCase().includes('caption') || 
                 key.toLowerCase().includes('subtitle') || 
                 key.toLowerCase().includes('text') ||
                 key.toLowerCase().includes('transcript'))) {
              methods.push(key);
            }
          }
          console.log('[어그로필터 main-world] 플레이어 자막 관련 메서드:', methods);

          // getOption으로 자막 트랙 데이터 시도
          try {
            if (typeof player.getOption === 'function') {
              const captionModule = player.getOption('captions', 'tracklist');
              console.log('[어그로필터 main-world] captions tracklist:', JSON.stringify(captionModule)?.substring(0, 500));
              
              const track = player.getOption('captions', 'track');
              console.log('[어그로필터 main-world] captions track:', JSON.stringify(track)?.substring(0, 500));
            }
          } catch(e) { console.log('[어그로필터 main-world] getOption 오류:', e); }

          // getVideoData 시도
          try {
            if (typeof player.getVideoData === 'function') {
              const vd = player.getVideoData();
              console.log('[어그로필터 main-world] videoData keys:', Object.keys(vd || {}));
            }
          } catch(e) {}

          // 내부 자막 데이터 접근 시도
          try {
            // ytplayer.config 또는 내부 captionTracks
            if (typeof player.getPlayerResponse === 'function') {
              const resp = player.getPlayerResponse();
              const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (tracks && tracks.length > 0) {
                // baseUrl에서 직접 XMLHttpRequest로 시도 (fetch 대신)
                const track = tracks[0];
                console.log('[어그로필터 main-world] XHR로 자막 시도, URL:', track.baseUrl?.substring(0, 150));
                
                const xhr = new XMLHttpRequest();
                xhr.open('GET', track.baseUrl, false); // 동기 요청
                xhr.withCredentials = true;
                xhr.send();
                
                console.log('[어그로필터 main-world] XHR 상태:', xhr.status, '응답 길이:', xhr.responseText?.length);
                if (xhr.responseText && xhr.responseText.length > 10) {
                  result = { text: xhr.responseText, source: 'xhr' };
                } else {
                  result = { text: '', xhrStatus: xhr.status, xhrLength: xhr.responseText?.length, methods: methods };
                }
              }
            }
          } catch(e) { 
            console.log('[어그로필터 main-world] XHR 오류:', e);
            result = { text: '', error: e.message, methods: methods };
          }
        }
      }

      if (action === 'FETCH_CAPTION') {
        // main world에서 자막 URL fetch (쿠키/세션 포함)
        const captionUrl = event.data.url;
        if (captionUrl) {
          try {
            const resp = await fetch(captionUrl);
            if (resp.ok) {
              const text = await resp.text();
              console.log('[어그로필터 main-world] 자막 fetch 응답 길이:', text.length);
              result = { text: text, status: resp.status };
            } else {
              console.log('[어그로필터 main-world] 자막 fetch 실패:', resp.status);
              result = { text: '', status: resp.status };
            }
          } catch (e) {
            console.error('[어그로필터 main-world] 자막 fetch 오류:', e);
            result = { text: '', error: e.message };
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
