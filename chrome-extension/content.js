// 어그로필터 크롬 확장팩 - Content Script
// 유튜브 영상 페이지에서 "어그로필터 분석" 버튼을 삽입합니다.

(function () {
  'use strict';

  let currentVideoId = null;
  let buttonInserted = false;

  // 유튜브 URL에서 영상 ID 추출
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
  }

  // 현재 페이지의 전체 유튜브 URL
  function getVideoUrl() {
    return window.location.href;
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

    // 상세 보기 클릭
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

      // 기존 결과 카드 제거
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

          // 결과가 바로 있으면 카드 표시
          if (data.analysisData || data.scores) {
            const card = createResultCard(data);
            container.appendChild(card);
          } else if (data.analysisId || data.id) {
            // 분석 ID만 있으면 결과 조회
            const analysisId = data.analysisId || data.id;
            try {
              const resultResponse = await chrome.runtime.sendMessage({
                type: 'GET_RESULT',
                analysisId: analysisId,
              });
              if (resultResponse.success && resultResponse.data) {
                const card = createResultCard(resultResponse.data);
                container.appendChild(card);
              }
            } catch {
              // 결과 조회 실패 시 상세 페이지로 이동 링크만 표시
              const link = document.createElement('span');
              link.className = 'aggro-detail-link';
              link.textContent = '상세 분석 보기 →';
              link.style.marginTop = '8px';
              link.style.display = 'inline-block';
              link.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                  type: 'OPEN_RESULT_PAGE',
                  analysisId: analysisId,
                });
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
    const videoId = getVideoId();
    if (!videoId) return;

    // 이미 같은 영상에 버튼이 있으면 스킵
    if (videoId === currentVideoId && buttonInserted) return;

    // 기존 버튼 제거
    const existing = document.getElementById('aggro-filter-container');
    if (existing) existing.remove();

    // 유튜브 영상 제목 아래 영역 (owner 정보 위)
    const targetSelectors = [
      '#above-the-fold #top-row',           // 데스크톱: 제목 영역
      'ytd-watch-metadata #owner',          // 데스크톱: 채널 정보 영역
      '#info-contents #top-row',            // 대체 위치
      '#meta-contents #container',          // 대체 위치 2
    ];

    let target = null;
    for (const selector of targetSelectors) {
      target = document.querySelector(selector);
      if (target) break;
    }

    if (!target) return;

    const button = createAnalyzeButton();
    target.insertAdjacentElement('beforebegin', button);

    currentVideoId = videoId;
    buttonInserted = true;
  }

  // 유튜브 SPA 네비게이션 감지
  function observeNavigation() {
    // URL 변경 감지
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        buttonInserted = false;
        currentVideoId = null;
        // 기존 버튼 제거
        const existing = document.getElementById('aggro-filter-container');
        if (existing) existing.remove();
        // 새 페이지에 버튼 삽입 시도
        setTimeout(insertButton, 1500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // 초기 실행
  function init() {
    // 페이지 로드 후 버튼 삽입 시도 (유튜브 DOM이 준비될 때까지 재시도)
    let attempts = 0;
    const maxAttempts = 20;

    const tryInsert = () => {
      insertButton();
      attempts++;
      if (!buttonInserted && attempts < maxAttempts) {
        setTimeout(tryInsert, 1000);
      }
    };

    tryInsert();
    observeNavigation();
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
