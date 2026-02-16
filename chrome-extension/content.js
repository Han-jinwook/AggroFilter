// 어그로필터 크롬 확장팩 - Content Script
// 유튜브 영상 페이지에서 자막(transcript) + 메타데이터를 추출하여 웹사이트로 전달합니다.

(function () {
  'use strict';

  const LOG_PREFIX = '[어그로필터]';
  let currentVideoId = null;
  let buttonInserted = false;

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  // 유튜브 URL에서 영상 ID 추출
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
  }

  // 현재 페이지의 전체 유튜브 URL
  function getVideoUrl() {
    return window.location.href;
  }

  // 영상 페이지인지 확인
  function isWatchPage() {
    return window.location.pathname === '/watch' && !!getVideoId();
  }

  // ─── 메타데이터 추출 ───
  function extractMetadata() {
    const meta = {};

    // 영상 제목
    const titleEl = document.querySelector('ytd-watch-metadata yt-formatted-string.ytd-watch-metadata') ||
                     document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                     document.querySelector('#above-the-fold h1 yt-formatted-string') ||
                     document.querySelector('h1.title yt-formatted-string');
    meta.title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();

    // 채널명
    const channelEl = document.querySelector('ytd-channel-name yt-formatted-string a') ||
                       document.querySelector('#owner-name a') ||
                       document.querySelector('#channel-name a');
    meta.channelName = channelEl?.textContent?.trim() || '';

    // 영상 ID
    meta.videoId = getVideoId();

    // URL
    meta.url = getVideoUrl();

    return meta;
  }

  // ─── 자막(Transcript) 추출 ───

  // main-world.js에 요청을 보내고 응답을 받는 헬퍼
  function requestMainWorld(action, extraData) {
    return new Promise((resolve) => {
      const requestId = 'req_' + Math.random().toString(36).slice(2);
      const handler = (event) => {
        if (event.data?.type === 'AGGRO_MAIN_WORLD_RESPONSE' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };
      window.addEventListener('message', handler);

      window.postMessage({
        type: 'AGGRO_MAIN_WORLD_REQUEST',
        requestId: requestId,
        action: action,
        ...(extraData || {}),
      }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 10000);
    });
  }

  // 자막 트랙 URL에서 자막 아이템 fetch
  async function fetchCaptionItems(baseUrl) {
    // 1차: main-world.js를 통해 fetch (유튜브 쿠키/세션 포함 — 가장 신뢰성 높음)
    log('자막 fetch: main-world 경유 시도...');
    const mwResult = await requestMainWorld('FETCH_CAPTION', { url: baseUrl });
    if (mwResult?.text && mwResult.text.length > 10) {
      log('main-world fetch 성공, 응답 길이:', mwResult.text.length);
      const items = parseCaptionXml(mwResult.text);
      if (items && items.length > 0) return items;
      // XML 파싱 실패 시 JSON3 시도
      const mwJson = await requestMainWorld('FETCH_CAPTION', { url: baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3' });
      if (mwJson?.text && mwJson.text.length > 10) {
        const jsonItems = parseCaptionJson3(mwJson.text);
        if (jsonItems && jsonItems.length > 0) return jsonItems;
      }
    } else {
      log('main-world fetch 실패 또는 빈 응답:', mwResult);
    }

    // 2차: isolated world에서 직접 fetch (폴백)
    log('자막 fetch: isolated world 직접 시도...');
    const xmlItems = await fetchCaptionXml(baseUrl);
    if (xmlItems && xmlItems.length > 0) return xmlItems;

    const jsonItems = await fetchCaptionJson3(baseUrl);
    if (jsonItems && jsonItems.length > 0) return jsonItems;

    return null;
  }

  // XML 텍스트를 파싱하여 자막 아이템 배열로 변환
  function parseCaptionXml(text) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const textNodes = doc.querySelectorAll('text');

      if (textNodes.length === 0) {
        log('XML 파싱: <text> 노드 없음');
        return null;
      }

      const items = [];
      textNodes.forEach(node => {
        const content = node.textContent?.trim();
        if (!content) return;
        const decoded = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        items.push({
          text: decoded,
          start: parseFloat(node.getAttribute('start') || '0'),
          duration: parseFloat(node.getAttribute('dur') || '0'),
        });
      });

      log(`XML 파싱 성공: ${items.length}개 항목`);
      return items.length > 0 ? items : null;
    } catch (e) {
      log('XML 파싱 오류:', e);
      return null;
    }
  }

  // JSON3 텍스트를 파싱하여 자막 아이템 배열로 변환
  function parseCaptionJson3(text) {
    try {
      const json = JSON.parse(text);
      const events = json.events || [];
      const items = [];
      for (const event of events) {
        if (!event.segs) continue;
        const segText = event.segs.map(s => s.utf8 || '').join('').trim();
        if (!segText) continue;
        items.push({
          text: segText,
          start: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000,
        });
      }
      log(`JSON3 파싱 성공: ${items.length}개 항목`);
      return items.length > 0 ? items : null;
    } catch (e) {
      log('JSON3 파싱 오류:', e);
      return null;
    }
  }

  // XML 형식 자막 fetch (isolated world — 폴백용)
  async function fetchCaptionXml(baseUrl) {
    try {
      log('자막 XML fetch (isolated):', baseUrl.substring(0, 80) + '...');
      const response = await fetch(baseUrl);
      if (!response.ok) {
        log('자막 XML fetch 실패:', response.status);
        return null;
      }
      const text = await response.text();
      if (!text || text.length < 10) {
        log('자막 XML 응답 비어있음, 길이:', text.length);
        return null;
      }
      return parseCaptionXml(text);
    } catch (error) {
      log('자막 XML 오류:', error);
      return null;
    }
  }

  // JSON3 형식 자막 fetch (isolated world — 폴백용)
  async function fetchCaptionJson3(baseUrl) {
    try {
      const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
      log('자막 JSON3 fetch (isolated):', url.substring(0, 80) + '...');
      const response = await fetch(url);
      if (!response.ok) {
        log('자막 JSON3 fetch 실패:', response.status);
        return null;
      }
      const text = await response.text();
      if (!text || text.length < 10) {
        log('자막 JSON3 응답 비어있음');
        return null;
      }
      return parseCaptionJson3(text);
    } catch (error) {
      log('자막 JSON3 오류:', error);
      return null;
    }
  }

  // 자막 트랙 목록에서 최적 트랙 선택
  function pickBestTrack(captionTracks) {
    if (!captionTracks || captionTracks.length === 0) return null;
    return captionTracks.find(t => t.languageCode === 'ko') ||
           captionTracks.find(t => t.languageCode?.startsWith('ko')) ||
           captionTracks[0];
  }

  // 방법 1: main-world.js를 통해 movie_player / ytInitialPlayerResponse에서 자막 트랙 가져오기
  async function method1_mainWorld() {
    log('[방법1] main-world.js 통해 자막 트랙 요청...');

    const result = await requestMainWorld('GET_CAPTION_TRACKS');

    if (!result || !result.tracks || result.tracks.length === 0) {
      log('[방법1] 자막 트랙 없음');
      return null;
    }

    log(`[방법1] ${result.source}에서 자막 트랙 ${result.tracks.length}개 발견`);
    const track = pickBestTrack(result.tracks);
    if (!track?.baseUrl) {
      log('[방법1] 자막 URL 없음');
      return null;
    }

    log(`[방법1] 선택 트랙: ${track.name || track.languageCode}`);
    return await fetchCaptionItems(track.baseUrl);
  }

  // 방법 2: <script> 태그에서 ytInitialPlayerResponse 파싱 (초기 로드 시에만 유효)
  async function method2_scriptTag() {
    log('[방법2] script 태그에서 playerResponse 파싱 시도...');

    const scripts = document.querySelectorAll('script');
    let playerResponse = null;

    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
      if (match) {
        try { playerResponse = JSON.parse(match[1]); } catch { /* ignore */ }
        break;
      }
    }

    if (!playerResponse) {
      log('[방법2] script 태그에서 playerResponse 없음');
      return null;
    }

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      log('[방법2] 자막 트랙 없음');
      return null;
    }

    log(`[방법2] 자막 트랙 ${captions.length}개 발견`);
    const track = pickBestTrack(captions);
    if (!track?.baseUrl) {
      log('[방법2] 자막 URL 없음');
      return null;
    }

    log(`[방법2] 선택 트랙: ${track.name?.simpleText || track.languageCode}`);
    return await fetchCaptionItems(track.baseUrl);
  }

  // 방법 3: YouTube innertube API로 자막 가져오기
  async function method3_innertube() {
    log('[방법3] innertube API 시도...');

    const videoId = getVideoId();
    if (!videoId) return null;

    // main-world.js를 통해 ytcfg 데이터 가져오기
    const ytcfgData = await requestMainWorld('GET_YTCFG');

    if (!ytcfgData?.apiKey) {
      log('[방법3] ytcfg 데이터 없음');
      return null;
    }

    log(`[방법3] innertube API 키: ${ytcfgData.apiKey.substring(0, 10)}...`);

    try {
      const playerResp = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${ytcfgData.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoId,
          context: {
            client: {
              clientName: ytcfgData.clientName || 'WEB',
              clientVersion: ytcfgData.clientVersion || '2.20240101.00.00',
            }
          }
        })
      });

      if (!playerResp.ok) {
        log('[방법3] player API 실패:', playerResp.status);
        return null;
      }

      const playerData = await playerResp.json();
      const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captions || captions.length === 0) {
        log('[방법3] innertube 자막 트랙 없음');
        return null;
      }

      log(`[방법3] 자막 트랙 ${captions.length}개 발견`);
      const track = pickBestTrack(captions);
      if (!track?.baseUrl) {
        log('[방법3] 자막 URL 없음');
        return null;
      }

      log(`[방법3] 선택 트랙: ${track.name?.simpleText || track.languageCode}`);
      return await fetchCaptionItems(track.baseUrl);
    } catch (error) {
      log('[방법3] innertube 오류:', error);
      return null;
    }
  }

  // 방법 4: 유튜브 자막 패널에서 텍스트 추출 (최후 폴백)
  function method4_panel() {
    log('[방법4] 자막 패널 시도...');
    const segments = document.querySelectorAll(
      'ytd-transcript-segment-renderer yt-formatted-string.segment-text'
    );
    if (segments.length === 0) {
      log('[방법4] 자막 패널 없음');
      return null;
    }

    const items = [];
    segments.forEach(seg => {
      const text = seg.textContent?.trim();
      if (text) {
        items.push({ text, start: 0, duration: 0 });
      }
    });

    log(`[방법4] 자막 패널에서 추출: ${items.length}개 항목`);
    return items.length > 0 ? items : null;
  }

  // 자막 추출 메인 — 4가지 방법을 순서대로 시도
  async function extractTranscript() {
    log('=== 자막 추출 시작 ===');

    // 방법 1: main-world.js (movie_player / ytInitialPlayerResponse)
    const items1 = await method1_mainWorld();
    if (items1 && items1.length > 0) { log('✅ 방법1 성공 (main-world)'); return items1; }

    // 방법 2: script 태그 파싱
    const items2 = await method2_scriptTag();
    if (items2 && items2.length > 0) { log('✅ 방법2 성공 (script tag)'); return items2; }

    // 방법 3: innertube API
    const items3 = await method3_innertube();
    if (items3 && items3.length > 0) { log('✅ 방법3 성공 (innertube)'); return items3; }

    // 방법 4: 자막 패널 DOM
    const items4 = method4_panel();
    if (items4 && items4.length > 0) { log('✅ 방법4 성공 (panel)'); return items4; }

    log('❌ 모든 자막 추출 방법 실패');
    return [];
  }

  // ─── 분석 버튼 ───
  function createAnalyzeButton() {
    const container = document.createElement('div');
    container.className = 'aggro-filter-container';
    container.id = 'aggro-filter-container';

    const btn = document.createElement('button');
    btn.className = 'aggro-filter-btn';
    btn.innerHTML = '🚦 어그로필터 분석';

    btn.addEventListener('click', async () => {
      if (btn.classList.contains('analyzing')) return;

      btn.classList.add('analyzing');
      btn.innerHTML = '<span class="aggro-spinner"></span> 자막 추출 중...';

      try {
        // 1. 메타데이터 추출
        const metadata = extractMetadata();
        log('메타데이터:', metadata);

        // 2. 자막 추출
        btn.innerHTML = '<span class="aggro-spinner"></span> 자막 가져오는 중...';
        const transcriptItems = await extractTranscript();
        const transcript = transcriptItems.map(item => item.text).join(' ');

        log(`자막: ${transcript.length}자, ${transcriptItems.length}개 항목`);

        // 3. background로 전달 → 자막 저장 + 웹사이트 새 탭 열기
        btn.innerHTML = '<span class="aggro-spinner"></span> 웹으로 이동 중...';

        chrome.runtime.sendMessage({
          type: 'ANALYZE_VIDEO',
          data: {
            url: metadata.url,
            videoId: metadata.videoId,
            title: metadata.title,
            channelName: metadata.channelName,
            transcript: transcript,
            transcriptItems: transcriptItems,
            hasTranscript: transcript.length > 50,
            from: 'chrome-extension',
          }
        });

        btn.classList.remove('analyzing');
        btn.innerHTML = '✅ 새 탭에서 분석 진행 중';
        setTimeout(() => {
          btn.innerHTML = '🚦 어그로필터 분석';
        }, 5000);

      } catch (error) {
        log('분석 시작 오류:', error);
        btn.classList.remove('analyzing');
        btn.innerHTML = '❌ 오류 발생';
        setTimeout(() => {
          btn.innerHTML = '🚦 어그로필터 분석';
        }, 3000);
      }
    });

    container.appendChild(btn);
    return container;
  }

  // 버튼을 유튜브 페이지에 삽입
  function insertButton() {
    if (!isWatchPage()) return;

    const videoId = getVideoId();
    if (!videoId) return;

    // 이미 같은 영상에 버튼이 있으면 스킵
    if (videoId === currentVideoId && buttonInserted) {
      // DOM에서 실제로 존재하는지도 확인
      if (document.getElementById('aggro-filter-container')) return;
    }

    // 기존 버튼 제거
    const existing = document.getElementById('aggro-filter-container');
    if (existing) existing.remove();

    // 유튜브 영상 제목/채널 영역 셀렉터 (우선순위 순)
    const targetSelectors = [
      'ytd-watch-metadata #owner',                    // 2024+ 데스크톱: 채널 정보
      '#above-the-fold #owner',                        // 대체: above-the-fold 내 owner
      '#above-the-fold ytd-video-owner-renderer',      // 대체: 비디오 소유자 렌더러
      '#above-the-fold #top-row',                      // 대체: top-row
      'ytd-watch-metadata #top-row',                   // 대체: metadata 내 top-row
      '#info-contents ytd-video-owner-renderer',       // 구형 레이아웃
      '#info-contents #top-row',                       // 구형 레이아웃 2
      '#meta-contents #container',                     // 구형 레이아웃 3
      'ytd-video-primary-info-renderer',               // 최후 폴백: 영상 기본 정보
    ];

    let target = null;
    let matchedSelector = '';
    for (const selector of targetSelectors) {
      target = document.querySelector(selector);
      if (target) {
        matchedSelector = selector;
        break;
      }
    }

    if (!target) {
      log('삽입 대상 DOM을 찾지 못했습니다. 재시도 예정...');
      return false;
    }

    log(`버튼 삽입 위치: ${matchedSelector}`);

    const button = createAnalyzeButton();
    target.insertAdjacentElement('beforebegin', button);

    currentVideoId = videoId;
    buttonInserted = true;
    log(`버튼 삽입 완료 (videoId: ${videoId})`);
    return true;
  }

  // 상태 리셋 및 재삽입
  function resetAndInsert() {
    buttonInserted = false;
    currentVideoId = null;
    const existing = document.getElementById('aggro-filter-container');
    if (existing) existing.remove();
    retryInsert();
  }

  // 재시도 로직
  function retryInsert() {
    let attempts = 0;
    const maxAttempts = 30;

    const tryInsert = () => {
      if (insertButton()) return; // 성공
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryInsert, 500);
      } else {
        log('최대 재시도 횟수 초과. 버튼 삽입 실패.');
      }
    };

    tryInsert();
  }

  // 유튜브 SPA 네비게이션 감지
  function observeNavigation() {
    // 방법 1: yt-navigate-finish 이벤트 (유튜브 공식 SPA 이벤트)
    document.addEventListener('yt-navigate-finish', () => {
      log('yt-navigate-finish 감지');
      resetAndInsert();
    });

    // 방법 2: yt-page-data-updated 이벤트
    document.addEventListener('yt-page-data-updated', () => {
      log('yt-page-data-updated 감지');
      if (!document.getElementById('aggro-filter-container') && isWatchPage()) {
        resetAndInsert();
      }
    });

    // 방법 3: URL 변경 감지 (폴백)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        log('URL 변경 감지:', location.href);
        setTimeout(resetAndInsert, 1000);
      }
    });

    if (document.body) {
      urlObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // 초기 실행
  function init() {
    log('Content script 로드됨. URL:', location.href);
    retryInsert();
    observeNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
