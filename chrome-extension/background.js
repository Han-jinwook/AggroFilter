// 어그로필터 크롬 확장팩 - Background Service Worker
// content script에서 추출한 자막/메타데이터를 저장하고 웹사이트를 열어줍니다.
// 어그로필터 사이트의 inject-transcript.js가 자막 데이터를 가져갑니다.

// 로컬 테스트: 'http://localhost:3000', 배포: 'https://aggrofilter.sundreamer.app'
const SITE_URL = 'https://aggrofilter.sundreamer.app';
const PENDING_KEY = 'pendingAnalysisData';

// 최신 자막 데이터 (메모리에 보관, 웹사이트 content script가 가져갈 때까지)
let pendingAnalysisData = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 유튜브 content script → 자막 추출 완료, 웹사이트 열기
  if (message.type === 'ANALYZE_VIDEO') {
    const data = message.data;
    pendingAnalysisData = data;

    console.log(`[어그로필터] 자막 저장: ${data.videoId}, ${data.transcript?.length || 0}자`);

    // MV3 service worker가 suspend되어도 전달되도록 storage에 백업
    chrome.storage.local.set({
      [PENDING_KEY]: {
        data,
        savedAt: Date.now(),
      },
    });

    // 웹사이트 새 탭 열기 - 결과 스켈레톤 경로로 바로 진입 (영상 카드 즉시 노출)
    // inject-transcript.js가 자동으로 자막 데이터를 주입
    const analyzeUrl = `${SITE_URL}/p-result?url=${encodeURIComponent(data.url)}&from=chrome-extension`;
    chrome.tabs.create({ url: analyzeUrl });

    sendResponse({ success: true });
    return false;
  }

  // 어그로필터 사이트의 inject-transcript.js → 자막 데이터 요청
  if (message.type === 'GET_TRANSCRIPT_DATA') {
    console.log('[어그로필터] inject-transcript.js에서 자막 데이터 요청');

    if (pendingAnalysisData) {
      const data = pendingAnalysisData;
      // 삭제 방지: 새로고침 시에도 데이터가 유지되도록 지우지 않음
      // pendingAnalysisData = null;
      // chrome.storage.local.remove(PENDING_KEY);
      sendResponse({ success: true, data });
      return false;
    }

    chrome.storage.local.get([PENDING_KEY], (result) => {
      const wrapped = result?.[PENDING_KEY];
      const data = wrapped?.data || null;

      // 10분 이상 지난 데이터만 폐기 (새로고침, 탭 닫기 대응을 위해 10분으로 보존시간 연장)
      if (wrapped?.savedAt && Date.now() - wrapped.savedAt > 10 * 60 * 1000) {
        chrome.storage.local.remove(PENDING_KEY);
        sendResponse({ success: true, data: null });
        return;
      }

      // 삭제 방지: chrome.storage.local.remove(PENDING_KEY);
      sendResponse({ success: true, data });
    });

    return true;
  }

  // 사용자 정보 조회
  if (message.type === 'GET_USER') {
    (async () => {
      const result = await chrome.storage.local.get(['userEmail', 'userNickname']);
      sendResponse({ success: true, data: result.userEmail ? result : null });
    })();
    return true;
  }

  // 외부(웹앱)로부터 들어오는 세션 토큰 저장 메시지 처리
  if (message.type === 'SET_SESSION_TOKEN') {
    chrome.storage.local.set({ merlin_session_token: message.token }, () => {
      console.log('[어그로필터 확장팩] 세션 토큰 동기화 완료');
      sendResponse({ success: true });
    });
    return true;
  }
});

// 외부 웹앱(externally_connectable) 다이렉트 연동
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_SESSION_TOKEN') {
    chrome.storage.local.set({ merlin_session_token: message.token }, () => {
      console.log('[어그로필터 확장팩] 외부 웹앱으로부터 세션 토큰 동기화 완료');
      sendResponse({ success: true });
    });
    return true;
  }
});

// ─── 백그라운드 폴링 자동 분석 연동 ───

// 알람 등록 (5분 간격)
chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
});

function setupAlarm() {
  chrome.alarms.clear('queue-polling-alarm', () => {
    chrome.alarms.create('queue-polling-alarm', { periodInMinutes: 5 });
    console.log('[어그로필터 확장팩] 5분 폴링 알람 등록 완료');
  });
}

// 알람 트리거 시 큐 모니터링
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'queue-polling-alarm') {
    console.log('[어그로필터 확장팩] 알람 트리거 - 대기열 검사 시작');
    pollAndProcessQueue();
  }
});

// 폴링 및 분석 실행 메인 함수
async function pollAndProcessQueue() {
  try {
    const storage = await chrome.storage.local.get(['merlin_session_token']);
    const token = storage.merlin_session_token;
    if (!token) {
      console.log('[어그로필터 확장팩] 로그인 세션 토큰 없음 - 폴링 스킵');
      return;
    }

    // 1. pending 인 예약 1건 조회
    const getRes = await fetch(`${SITE_URL}/api/analysis/queue?pendingOnly=true`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!getRes.ok) {
      console.warn('[어그로필터 확장팩] 대기열 조회 실패:', getRes.status);
      return;
    }

    const getData = await getRes.json();
    if (!getData.success || !getData.queue) {
      console.log('[어그로필터 확장팩] 처리할 대기 영상 없음');
      return;
    }

    const { f_id, f_video_url } = getData.queue;
    console.log(`[어그로필터 확장팩] 대기 영상 감지: ${f_video_url} (Queue ID: ${f_id})`);

    // 2. 상태를 processing 으로 변경
    const patchProcessingRes = await fetch(`${SITE_URL}/api/analysis/queue`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: f_id, status: 'processing' })
    });

    if (!patchProcessingRes.ok) {
      console.error('[어그로필터 확장팩] 상태 변경 실패(processing)');
      return;
    }

    // 3. 서버에 정밀 분석 요청 (자막 파싱 및 Gemini 분석 수행)
    console.log('[어그로필터 확장팩] 서버 정밀 분석 API 호출 시작...');
    const requestRes = await fetch(`${SITE_URL}/api/analysis/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url: f_video_url })
    });

    if (requestRes.ok) {
      console.log('[어그로필터 확장팩] 분석 성공! 완료 처리 중...');
      
      // 4. 상태를 completed 로 변경
      await fetch(`${SITE_URL}/api/analysis/queue`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: f_id, status: 'completed' })
      });

      // 5. 바탕화면 OS 푸시 알림 발송
      chrome.notifications.create(`result-${f_id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '팩트체크 완료! 📱',
        message: '모바일에서 예약해 두신 영상의 분석이 완료되었습니다. 클릭하여 결과를 즉시 확인해 보세요!',
        priority: 2
      });

    } else {
      console.error('[어그로필터 확장팩] 분석 실패 - 실패 상태 갱신 중...');
      
      // 분석 실패 시 상태를 failed 로 변경
      await fetch(`${SITE_URL}/api/analysis/queue`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: f_id, status: 'failed' })
      });
    }

  } catch (err) {
    console.error('[어그로필터 확장팩] pollAndProcessQueue 에러:', err);
  }
}

// 알림 클릭 핸들러 (클릭 시 보관함 페이지 새 탭 오픈)
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('result-')) {
    chrome.tabs.create({ url: `${SITE_URL}/p-library` });
  }
});


