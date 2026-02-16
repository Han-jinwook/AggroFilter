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
  function createAnalyzeButton(mode = 'metadata') {
    const isPlayerMode = mode === 'player';
    const container = document.createElement('div');
    container.className = 'aggro-filter-container';
    if (isPlayerMode) container.classList.add('player-control');
    container.id = 'aggro-filter-container';

    const btn = document.createElement('button');
    btn.className = 'aggro-filter-btn';
    if (isPlayerMode) {
      btn.classList.add('player-control');
      btn.title = '어그로필터 분석';
      btn.innerHTML = '🚦';
    } else {
      btn.innerHTML = '🚦 어그로필터 분석';
    }

    const setButtonState = (state) => {
      if (isPlayerMode) {
        if (state === 'loading') btn.innerHTML = '⏳';
        else if (state === 'moving') btn.innerHTML = '↗';
        else if (state === 'success') btn.innerHTML = '✅';
        else if (state === 'error') btn.innerHTML = '❌';
        else btn.innerHTML = '🚦';
      } else {
        if (state === 'loading') btn.innerHTML = '<span class="aggro-spinner"></span> 자막 가져오는 중...';
        else if (state === 'moving') btn.innerHTML = '<span class="aggro-spinner"></span> 웹으로 이동 중...';
        else if (state === 'success') btn.innerHTML = '✅ 새 탭에서 분석 진행 중';
        else if (state === 'error') btn.innerHTML = '❌ 오류 발생';
        else btn.innerHTML = '🚦 어그로필터 분석';
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

    // 1순위: 영상 하단 플레이어 컨트롤 영역 (요청사항)
    const playerControls = document.querySelector('.ytp-right-controls');
    if (playerControls) {
      const button = createAnalyzeButton('player');
      playerControls.insertAdjacentElement('afterbegin', button);
      currentVideoId = videoId;
      buttonInserted = true;
      log('버튼 삽입 위치: .ytp-right-controls (영상 하단 컨트롤)');
      log(`버튼 삽입 완료 (videoId: ${videoId})`);
      return true;
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

    const button = createAnalyzeButton('metadata');
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
