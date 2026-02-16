// 어그로필터 크롬 확장팩 - Content Script
// 유튜브 영상 페이지에서 "어그로필터 분석" 버튼을 삽입합니다.

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

  // 신뢰도 점수 → 등급
  function getGrade(trust) {
    if (trust >= 70) return { label: 'Blue', className: 'aggro-grade-blue' };
    if (trust >= 40) return { label: 'Yellow', className: 'aggro-grade-yellow' };
    return { label: 'Red', className: 'aggro-grade-red' };
  }

  // 결과 미니 카드 생성
  function createResultCard(data) {
    const analysis = data.analysisData || data;
    const scores = analysis.scores || {};
    const grade = getGrade(scores.trust);
    const analysisId = analysis.id || analysis.analysisId;

    const card = document.createElement('div');
    card.className = 'aggro-result-card';
    card.innerHTML = `
      <div class="aggro-result-header">
        <span class="aggro-result-title">🚦 어그로필터 분석 결과</span>
        <span class="aggro-result-grade ${grade.className}">${grade.label}</span>
      </div>
      <div class="aggro-scores">
        <div class="aggro-score-item">
          <span class="aggro-score-label">정확성</span>
          <span class="aggro-score-value">${scores.accuracy ?? '-'}%</span>
        </div>
        <div class="aggro-score-item">
          <span class="aggro-score-label">어그로성</span>
          <span class="aggro-score-value">${scores.clickbait ?? '-'}%</span>
        </div>
        <div class="aggro-score-item">
          <span class="aggro-score-label">신뢰도</span>
          <span class="aggro-score-value">${scores.trust ?? '-'}</span>
        </div>
      </div>
      <span class="aggro-detail-link" data-analysis-id="${analysisId}">상세 분석 보기 →</span>
    `;

    card.querySelector('.aggro-detail-link').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_RESULT_PAGE',
        analysisId: analysisId,
      });
    });

    return card;
  }

  // 분석 버튼 생성
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
      btn.classList.remove('done', 'error');
      btn.innerHTML = '<span class="aggro-spinner"></span> 분석 중...';

      const oldCard = container.querySelector('.aggro-result-card');
      if (oldCard) oldCard.remove();

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'ANALYZE_VIDEO',
          videoUrl: getVideoUrl(),
        });

        if (response.success) {
          const data = response.data;
          btn.classList.remove('analyzing');
          btn.classList.add('done');
          btn.innerHTML = '✅ 분석 완료';

          if (data.analysisData || data.scores) {
            container.appendChild(createResultCard(data));
          } else if (data.analysisId || data.id) {
            const analysisId = data.analysisId || data.id;
            try {
              const resultResponse = await chrome.runtime.sendMessage({
                type: 'GET_RESULT',
                analysisId: analysisId,
              });
              if (resultResponse.success && resultResponse.data) {
                container.appendChild(createResultCard(resultResponse.data));
              }
            } catch {
              const link = document.createElement('span');
              link.className = 'aggro-detail-link';
              link.textContent = '상세 분석 보기 →';
              link.style.cssText = 'margin-top:8px;display:inline-block';
              link.addEventListener('click', () => {
                chrome.runtime.sendMessage({ type: 'OPEN_RESULT_PAGE', analysisId });
              });
              container.appendChild(link);
            }
          }
        } else {
          btn.classList.remove('analyzing');
          btn.classList.add('error');
          btn.innerHTML = `❌ ${response.error || '분석 실패'}`;
          setTimeout(() => {
            btn.classList.remove('error');
            btn.innerHTML = '🚦 어그로필터 분석';
          }, 3000);
        }
      } catch (error) {
        log('분석 오류:', error);
        btn.classList.remove('analyzing');
        btn.classList.add('error');
        btn.innerHTML = '❌ 오류 발생';
        setTimeout(() => {
          btn.classList.remove('error');
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
