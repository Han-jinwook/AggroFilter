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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 유튜브 URL에서 영상 ID 추출
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('v')) return params.get('v');

    // Shorts 대응
    const match = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    if (match) return match[1];

    return null;
  }

  // 현재 페이지의 전체 유튜브 URL
  function getVideoUrl() {
    return window.location.href;
  }

  // 영상 페이지인지 확인 (Watch or Shorts)
  function isTargetPage() {
    const path = window.location.pathname;
    return (path === '/watch' || path.startsWith('/shorts/')) && !!getVideoId();
  }

  // ─── 메타데이터 추출 ───
  function extractMetadata() {
    const meta = {};
    meta.videoId = getVideoId();
    meta.url = getVideoUrl();

    // Shorts인 경우
    if (window.location.pathname.startsWith('/shorts/')) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        const titleEl = activeReel.querySelector('#title yt-formatted-string') || 
                        activeReel.querySelector('h2.title') || 
                        activeReel.querySelector('.ytd-shorts-player-overlay-model-renderer-title');
        meta.title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();

        const channelEl = activeReel.querySelector('#channel-name a') || 
                          activeReel.querySelector('ytd-channel-name a') ||
                          activeReel.querySelector('.ytd-channel-name a');
        meta.channelName = channelEl?.textContent?.trim() || '';
      } else {
        meta.title = document.title.replace(' - YouTube', '').trim();
        meta.channelName = '';
      }
      return meta;
    }

    // 일반 Watch 페이지
    const titleEl = document.querySelector('ytd-watch-metadata yt-formatted-string.ytd-watch-metadata') ||
                     document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                     document.querySelector('#above-the-fold h1 yt-formatted-string') ||
                     document.querySelector('h1.title yt-formatted-string');
    meta.title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();

    const channelEl = document.querySelector('ytd-channel-name yt-formatted-string a') ||
                       document.querySelector('#owner-name a') ||
                       document.querySelector('#channel-name a');
    meta.channelName = channelEl?.textContent?.trim() || '';

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
      }, 30000);
    });
  }

  // 방법 1: innertube get_transcript 엔드포인트 (main-world.js 경유)
  async function method1_getTranscript() {
    log('[방법1] innertube get_transcript 시도...');
    const videoId = getVideoId();
    if (!videoId) { log('[방법1] videoId 없음'); return null; }

    const result = await requestMainWorld('GET_TRANSCRIPT', { videoId });
    if (result?.items && result.items.length > 0) {
      log(`[방법1] ✅ 성공: ${result.items.length}개 세그먼트`);
      return result.items;
    }

    log('[방법1] 실패:', result?.error || 'unknown');
    return null;
  }

  function collectPanelItems() {
    const segments = document.querySelectorAll(
      'ytd-transcript-segment-renderer yt-formatted-string.segment-text'
    );
    if (segments.length === 0) return null;

    const items = [];
    segments.forEach((seg) => {
      const text = seg.textContent?.trim();
      if (text) items.push({ text, start: 0, duration: 0 });
    });
    return items.length > 0 ? items : null;
  }

  async function waitForPanelItems(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const items = collectPanelItems();
      if (items && items.length > 0) return items;
      await sleep(250);
    }
    return null;
  }

  function findClickableByText(texts) {
    const candidates = document.querySelectorAll(
      'button, a, ytd-menu-service-item-renderer, tp-yt-paper-item, yt-formatted-string'
    );
    for (const el of candidates) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (!t) continue;
      if (texts.some((q) => t.includes(q))) {
        return el.closest('button, a, ytd-menu-service-item-renderer, tp-yt-paper-item') || el;
      }
    }
    return null;
  }

  // 방법 2: 자막 패널 자동 오픈 후 텍스트 추출 (최후 폴백)
  async function method2_panel() {
    log('[방법2] 자막 패널 시도...');

    // 이미 열려있는 경우
    const already = collectPanelItems();
    if (already && already.length > 0) {
      log(`[방법2] 자막 패널에서 추출: ${already.length}개 항목`);
      return already;
    }

    // 1) "스크립트 표시 / Show transcript" 직접 클릭 시도
    const transcriptDirect = findClickableByText(['show transcript', 'transcript', '스크립트 표시', '대본 보기']);
    if (transcriptDirect) {
      transcriptDirect.click();
      const items = await waitForPanelItems(5000);
      if (items && items.length > 0) {
        log(`[방법2] 자막 패널(직접 오픈) 추출: ${items.length}개 항목`);
        return items;
      }
    }

    // 2) 더보기 메뉴 열기 후 transcript 메뉴 클릭
    const moreButton = document.querySelector(
      'button[aria-label*="더보기"], button[aria-label*="More"], ytd-menu-renderer button'
    );
    if (moreButton) {
      moreButton.click();
      await sleep(300);

      const transcriptMenu = findClickableByText(['show transcript', 'transcript', '스크립트 표시', '대본 보기']);
      if (transcriptMenu) {
        transcriptMenu.click();
        const items = await waitForPanelItems(6000);
        if (items && items.length > 0) {
          log(`[방법2] 자막 패널(메뉴 오픈) 추출: ${items.length}개 항목`);
          return items;
        }
      }
    }

    log('[방법2] 자막 패널 없음');
    return null;
  }

  // 자막 추출 메인
  async function extractTranscript() {
    log('=== 자막 추출 시작 ===');

    // 방법 1: innertube get_transcript (가장 신뢰성 높음)
    const items1 = await method1_getTranscript();
    if (items1 && items1.length > 0) return items1;

    // 방법 2: 자막 패널 DOM (폴백)
    const items2 = await method2_panel();
    if (items2 && items2.length > 0) { log('✅ 방법2 성공 (panel)'); return items2; }

    log('❌ 모든 자막 추출 방법 실패');
    return [];
  }

  // ─── 분석 버튼 ───
  function createAnalyzeButton() {
    // 확장 프로그램 컨텍스트 유효성 체크
    if (!chrome.runtime?.id) {
      log('확장 프로그램 컨텍스트가 무효화되었습니다. 새로고침이 필요합니다.');
      return null;
    }

    const container = document.createElement('div');
    container.className = 'aggro-filter-container';
    container.classList.add('channel-action');
    container.id = 'aggro-filter-container';

    const btn = document.createElement('button');
    btn.className = 'aggro-filter-btn';
    btn.classList.add('channel-action');
    btn.setAttribute('aria-label', '어그로필터 분석');
    btn.title = '어그로필터 분석';
    const trafficLightIconUrl = chrome.runtime.getURL('icons/traffic-light-character.png');
    btn.innerHTML = `
      <span class="aggro-logo" aria-hidden="true">
        <img src="${trafficLightIconUrl}" alt="어그로필터" class="aggro-logo-image" />
      </span>
    `;

    const setButtonState = (state) => {
      btn.classList.remove('is-loading', 'is-success', 'is-error');
      if (state === 'loading' || state === 'moving') {
        btn.classList.add('is-loading');
        btn.title = state === 'loading' ? '자막 추출 중...' : '분석 페이지 여는 중...';
      } else if (state === 'success') {
        btn.classList.add('is-success');
        btn.title = '새 탭에서 분석 진행 중';
      } else if (state === 'error') {
        btn.classList.add('is-error');
        btn.title = '오류 발생';
      } else {
        btn.title = '어그로필터 분석';
      }
    };

    btn.addEventListener('click', async () => {
      if (btn.classList.contains('analyzing')) return;

      btn.classList.add('analyzing');
      setButtonState('loading');

      try {
        // 1. 메타데이터 추출
        const metadata = extractMetadata();
        log('메타데이터:', metadata);

        // 2. 자막 추출
        setButtonState('loading');
        const transcriptItems = await extractTranscript();
        const transcript = transcriptItems.map(item => item.text).join(' ');

        log(`자막: ${transcript.length}자, ${transcriptItems.length}개 항목`);

        // 3. background로 전달 → 자막 저장 + 웹사이트 새 탭 열기
        setButtonState('moving');

        if (!chrome.runtime?.id) {
          alert('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해주세요.');
          log('확장 프로그램 컨텍스트 무효화됨');
          setButtonState('error');
          btn.classList.remove('analyzing');
          return;
        }

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
        }, (response) => {
          if (chrome.runtime.lastError) {
             log('❌ Background 전달 실패:', chrome.runtime.lastError.message);
             setButtonState('error');
          } else {
             log('✅ Background 전달 성공:', response);
          }
        });

        btn.classList.remove('analyzing');
        setButtonState('success');
        setTimeout(() => {
          setButtonState('idle');
        }, 5000);

      } catch (error) {
        log('분석 시작 오류:', error);
        btn.classList.remove('analyzing');
        setButtonState('error');
        setTimeout(() => {
          setButtonState('idle');
        }, 3000);
      }
    });

    container.appendChild(btn);
    return container;
  }

  // 버튼을 유튜브 페이지에 삽입
  function insertButton() {
    if (!isTargetPage()) return;

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

    // ─── Shorts 처리 ───
    if (window.location.pathname.startsWith('/shorts/')) {
      const isVisible = (el) => {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        const rect = el.getBoundingClientRect?.();
        return !!rect && rect.width > 0 && rect.height > 0;
      };

      // 1. 현재 활성화된 릴 찾기 (DOM 변형 대응)
      let activeReel = null;
      const activeReelSelectors = [
        'ytd-reel-video-renderer[is-active]',
        'ytd-reel-video-renderer[is-active="true"]',
        'ytd-reel-video-renderer[visibility="REEL_VIDEO_VISIBLE"]',
        'ytd-reel-video-renderer.is-active',
        'ytd-reel-video-renderer[aria-hidden="false"]'
      ];

      for (const selector of activeReelSelectors) {
        const candidate = document.querySelector(selector);
        if (candidate && isVisible(candidate)) {
          activeReel = candidate;
          break;
        }
      }

      // 폴백 1: 현재 videoId를 포함한 링크를 기준으로 reel 찾기
      if (!activeReel) {
        const currentShortsLink = document.querySelector(`a[href*="/shorts/${videoId}"]`);
        const candidate = currentShortsLink?.closest('ytd-reel-video-renderer');
        if (candidate && isVisible(candidate)) activeReel = candidate;
      }

      // 폴백 2: 가시한 reel 중 첫 번째
      if (!activeReel) {
        const reels = document.querySelectorAll('ytd-reel-video-renderer');
        for (const reel of reels) {
          if (isVisible(reel)) {
            activeReel = reel;
            break;
          }
        }
      }

      // 활성 reel을 못 찾더라도 문서 전체에서 탐색 시도
      const searchRoot = activeReel || document;

      // Shorts: 구독 버튼 찾기 (다양한 선택자 시도)
      const shortsSubscribeSelectors = [
        '#actions ytd-subscribe-button-renderer',
        '#actions #subscribe-button',
        '#actions #subscribe-button-shape',
        '#actions yt-button-shape#subscribe-button-shape',
        '#actions yt-button-shape',
        '#actions button[aria-label*="구독"]',
        '#actions button[aria-label*="Subscribe"]',
        'ytd-video-owner-renderer ytd-subscribe-button-renderer',
        'ytd-video-owner-renderer #subscribe-button',
        'ytd-video-owner-renderer #subscribe-button-shape',
        'ytd-video-owner-renderer yt-button-shape#subscribe-button-shape',
        'ytd-video-owner-renderer yt-button-shape',
        'ytd-video-owner-renderer button[aria-label*="구독"]',
        'ytd-video-owner-renderer button[aria-label*="Subscribe"]',
        'ytd-shorts-player-overlay-model-renderer #subscribe-button',
        '#metadata-container #subscribe-button',
        '#subscribe-button-container',
        'ytd-reel-player-overlay-renderer #subscribe-button',
        'ytd-subscribe-button-renderer',
        '#subscribe-button',
        '#subscribe-button-shape',
        'yt-button-shape#subscribe-button-shape'
      ];

      let subscribeTarget = null;
      let usedSelector = '';
      let insertMode = 'afterend'; // 'afterend' or 'append'

      // 1. 선택자 기반 검색
      for (const selector of shortsSubscribeSelectors) {
        const el = searchRoot.querySelector(selector);
        if (el) {
          subscribeTarget = el;
          usedSelector = selector;
          break;
        }
      }

      // 2. 텍스트 기반 검색 ("구독" or "Subscribe")
      if (!subscribeTarget) {
        const candidates = searchRoot.querySelectorAll('button, ytd-subscribe-button-renderer, div[role="button"], yt-button-shape');
        for (const candidate of candidates) {
          const text = candidate.textContent?.replace(/\s+/g, ' ').trim();
          if (/\bsubscribe\b/i.test(text) || text === '구독' || text.includes('구독')) {
             subscribeTarget = candidate;
             usedSelector = 'text-match (' + text + ')';
             // 버튼 모양 컨테이너가 있으면 그 상위를 타겟으로 잡는게 안전할 수 있음
             const wrapper = candidate.closest('ytd-subscribe-button-renderer');
             if (wrapper) subscribeTarget = wrapper;
             break;
          }
        }
      }

      // 3. 구독 버튼이 없다면 채널 이름 옆에라도 붙이기 (폴백 1)
      if (!subscribeTarget) {
         const channelNameSelectors = [
           '#channel-name',
           'ytd-channel-name',
           '#text-container.ytd-channel-name'
         ];
         for (const selector of channelNameSelectors) {
           const el = searchRoot.querySelector(selector);
           if (el) {
             subscribeTarget = el;
             usedSelector = selector + ' (fallback: channel)';
             break;
           }
         }
      }

      // 4. Owner Container 내부 끝에 추가 (폴백 2)
      if (!subscribeTarget) {
         const container = searchRoot.querySelector('ytd-video-owner-renderer') || searchRoot.querySelector('#actions');
         if (container) {
             subscribeTarget = container;
             usedSelector = `${container.tagName.toLowerCase()} (fallback: container)`;
             insertMode = 'append';
         }
      }

      // 주의: 액션 바(좋아요/싫어요) 폴백은 제거함 (사용자 피드백: 화면 침범)

      if (subscribeTarget) {
        const button = createAnalyzeButton();
        if (button) {
          // Shorts 모드 클래스 추가
          button.classList.add('shorts-mode');
          
          // Shorts UI에서는 버튼이 겹치지 않게 스타일 조정 필요할 수 있음
          if (insertMode === 'append') {
             subscribeTarget.appendChild(button);
          } else {
             subscribeTarget.insertAdjacentElement('afterend', button);
          }
          
          currentVideoId = videoId;
          buttonInserted = true;
          log(`버튼 삽입 완료 (Shorts, videoId: ${videoId}, selector: ${usedSelector}, mode: ${insertMode})`);
          return true;
        }
      } else {
        // 모든 시도 실패 -> 재시도 유도 (return false)
        log('Shorts 타겟 요소(구독/채널/컨테이너) 못 찾음. 다음 재시도 대기...');
      }
      return false;
    }

    // ─── 일반 Watch 페이지 처리 ───
    // 1순위: 채널/구독 영역의 오른쪽 (요청사항)
    const subscribeSelectors = [
      'ytd-watch-metadata #owner #subscribe-button',
      '#above-the-fold #owner #subscribe-button',
      '#owner ytd-subscribe-button-renderer',
      'ytd-video-owner-renderer #subscribe-button',
    ];

    let subscribeTarget = null;
    let subscribeSelector = '';
    for (const selector of subscribeSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        subscribeTarget = el;
        subscribeSelector = selector;
        break;
      }
    }

    if (subscribeTarget) {
      const button = createAnalyzeButton();
      if (button) {
        subscribeTarget.insertAdjacentElement('afterend', button);
        currentVideoId = videoId;
        buttonInserted = true;
        log(`버튼 삽입 위치: ${subscribeSelector} (구독 오른쪽)`);
        log(`버튼 삽입 완료 (videoId: ${videoId})`);
        return true;
      }
    }

    // 2순위: 유튜브 영상 제목/채널 영역 셀렉터 (폴백)
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
    if (button) {
      target.insertAdjacentElement('beforebegin', button);
      
      currentVideoId = videoId;
      buttonInserted = true;
      log(`버튼 삽입 완료 (videoId: ${videoId})`);
      return true;
    }
    return false;
  }

  // 현재 활성 retry 세션 ID (이전 루프 취소용)
  let retrySessionId = 0;

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
    const sessionId = ++retrySessionId;
    let attempts = 0;
    const maxAttempts = 30;

    const tryInsert = () => {
      if (sessionId !== retrySessionId) return; // 새 세션이 시작됐으면 중단
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
    let lastUrl = location.href;
    let resetDebounceTimer = null;

    function scheduleReset(source, delay = 0) {
      if (resetDebounceTimer) clearTimeout(resetDebounceTimer);
      resetDebounceTimer = setTimeout(() => {
        resetDebounceTimer = null;
        const newUrl = location.href;
        const newVideoId = getVideoId();

        // 같은 영상이고 버튼이 이미 있으면 무시
        if (newVideoId && newVideoId === currentVideoId && document.getElementById('aggro-filter-container')) {
          return;
        }

        log(`${source} 감지 (URL: ${newUrl !== lastUrl ? '변경됨' : '동일'})`);
        lastUrl = newUrl;
        resetAndInsert();
      }, delay);
    }

    // 방법 1: yt-navigate-finish 이벤트 (유튜브 공식 SPA 이벤트) - 즉시 처리
    document.addEventListener('yt-navigate-finish', () => scheduleReset('yt-navigate-finish', 0));

    // 방법 2: yt-page-data-updated 이벤트
    document.addEventListener('yt-page-data-updated', () => {
      if (!document.getElementById('aggro-filter-container') && isTargetPage()) {
        scheduleReset('yt-page-data-updated', 0);
      }
    });

    // 방법 3: URL 변경 감지 (폴백) - yt-navigate-finish보다 늦게 실행되도록 500ms 지연
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        log('URL 변경 감지:', location.href);
        scheduleReset('URL 변경', 500);
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
