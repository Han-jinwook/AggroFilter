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

  // 방법 1: ytInitialPlayerResponse에서 자막 트랙 URL 추출 후 fetch
  async function getTranscriptFromPlayerResponse() {
    try {
      // 페이지 소스에서 ytInitialPlayerResponse 찾기
      const scripts = document.querySelectorAll('script');
      let playerResponse = null;

      for (const script of scripts) {
        const text = script.textContent || '';
        const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          try {
            playerResponse = JSON.parse(match[1]);
          } catch { /* ignore */ }
          break;
        }
      }

      // SPA 환경에서는 window 객체에서 직접 접근 시도
      if (!playerResponse) {
        // inject script to extract from window
        const data = await new Promise((resolve) => {
          const handler = (event) => {
            if (event.data?.type === 'AGGRO_PLAYER_RESPONSE') {
              window.removeEventListener('message', handler);
              resolve(event.data.payload);
            }
          };
          window.addEventListener('message', handler);

          const injected = document.createElement('script');
          injected.textContent = `
            window.postMessage({
              type: 'AGGRO_PLAYER_RESPONSE',
              payload: window.ytInitialPlayerResponse || null
            }, '*');
          `;
          document.documentElement.appendChild(injected);
          injected.remove();

          // timeout
          setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
          }, 3000);
        });

        playerResponse = data;
      }

      if (!playerResponse) {
        log('playerResponse를 찾을 수 없습니다.');
        return null;
      }

      // captions → playerCaptionsTracklistRenderer → captionTracks
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        log('자막 트랙이 없습니다.');
        return null;
      }

      // 한국어 자막 우선, 없으면 첫 번째
      const koTrack = captions.find(t => t.languageCode === 'ko') ||
                       captions.find(t => t.languageCode?.startsWith('ko')) ||
                       captions[0];

      if (!koTrack?.baseUrl) {
        log('자막 URL을 찾을 수 없습니다.');
        return null;
      }

      log(`자막 트랙 발견: ${koTrack.name?.simpleText || koTrack.languageCode} (${koTrack.languageCode})`);

      // JSON 형식으로 자막 가져오기
      const url = koTrack.baseUrl + '&fmt=json3';
      const response = await fetch(url);
      if (!response.ok) {
        log('자막 fetch 실패:', response.status);
        return null;
      }

      const json = await response.json();
      const events = json.events || [];

      const items = [];
      for (const event of events) {
        if (!event.segs) continue;
        const text = event.segs.map(s => s.utf8 || '').join('').trim();
        if (!text) continue;
        items.push({
          text: text,
          start: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000,
        });
      }

      log(`자막 추출 성공: ${items.length}개 항목`);
      return items;
    } catch (error) {
      log('자막 추출 오류:', error);
      return null;
    }
  }

  // 방법 2: 유튜브 자막 패널에서 텍스트 추출 (폴백)
  function getTranscriptFromPanel() {
    const segments = document.querySelectorAll(
      'ytd-transcript-segment-renderer yt-formatted-string.segment-text'
    );
    if (segments.length === 0) return null;

    const items = [];
    segments.forEach(seg => {
      const text = seg.textContent?.trim();
      if (text) {
        items.push({ text, start: 0, duration: 0 });
      }
    });

    log(`자막 패널에서 추출: ${items.length}개 항목`);
    return items.length > 0 ? items : null;
  }

  // 자막 추출 메인
  async function extractTranscript() {
    // 방법 1 시도
    const items = await getTranscriptFromPlayerResponse();
    if (items && items.length > 0) return items;

    // 방법 2 시도 (폴백)
    const panelItems = getTranscriptFromPanel();
    if (panelItems && panelItems.length > 0) return panelItems;

    log('자막을 추출할 수 없습니다.');
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

        // 3. background로 전달 → API 호출 → 웹사이트 새 탭 열기
        btn.innerHTML = '<span class="aggro-spinner"></span> 분석 요청 중...';

        const response = await chrome.runtime.sendMessage({
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

        if (response?.success) {
          btn.classList.remove('analyzing');
          btn.innerHTML = '✅ 분석 완료 — 새 탭에서 확인하세요';
          setTimeout(() => {
            btn.innerHTML = '🚦 어그로필터 분석';
          }, 5000);
        } else {
          throw new Error(response?.error || '분석 요청 실패');
        }

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
