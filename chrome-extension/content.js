// 어그로필터 크롬 확장팩 - Content Script
// 유튜브 영상 페이지에서 "어그로필터 분석" 버튼을 삽입합니다.
// 버튼 클릭 시 어그로필터 웹사이트를 새 탭으로 열어 분석을 진행합니다.

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

  // 분석 버튼 생성
  function createAnalyzeButton() {
    const container = document.createElement('div');
    container.className = 'aggro-filter-container';
    container.id = 'aggro-filter-container';

    const btn = document.createElement('button');
    btn.className = 'aggro-filter-btn';
    btn.innerHTML = '🚦 어그로필터 분석';

    btn.addEventListener('click', () => {
      // 어그로필터 웹사이트로 이동하여 분석 진행
      chrome.runtime.sendMessage({
        type: 'ANALYZE_VIDEO',
        videoUrl: getVideoUrl(),
      });
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
