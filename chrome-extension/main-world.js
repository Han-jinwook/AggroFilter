// main world에서 실행되는 스크립트 (유튜브 페이지의 JS 객체에 직접 접근 가능)
// innertube get_transcript 엔드포인트를 사용하여 자막을 가져옵니다.

(function() {
  'use strict';

  const TAG = '[어그로필터 main-world]';

  // ytcfg에서 innertube 설정 가져오기
  function getInnertubeConfig() {
    if (typeof ytcfg === 'undefined' || !ytcfg.get) return null;
    return {
      apiKey: ytcfg.get('INNERTUBE_API_KEY'),
      clientName: ytcfg.get('INNERTUBE_CLIENT_NAME') || 'WEB',
      clientVersion: ytcfg.get('INNERTUBE_CLIENT_VERSION') || '2.20240101.00.00',
      clientNameHeader: String(ytcfg.get('INNERTUBE_CONTEXT_CLIENT_NAME') || 1),
      context: ytcfg.get('INNERTUBE_CONTEXT') || null,
      hl: ytcfg.get('HL') || 'ko',
      gl: ytcfg.get('GL') || 'KR',
      visitorData: ytcfg.get('VISITOR_DATA') || '',
      loggedIn: !!ytcfg.get('LOGGED_IN'),
    };
  }

  // innertube 요청용 context 생성
  function buildContext(cfg) {
    if (cfg.context && typeof cfg.context === 'object') {
      const cloned = JSON.parse(JSON.stringify(cfg.context));
      cloned.client = cloned.client || {};
      // 필요한 값은 최신 ytcfg 값으로 덮어써서 일관성 확보
      cloned.client.hl = cfg.hl;
      cloned.client.gl = cfg.gl;
      cloned.client.clientName = cfg.clientName;
      cloned.client.clientVersion = cfg.clientVersion;
      if (cfg.visitorData) cloned.client.visitorData = cfg.visitorData;
      return cloned;
    }

    return {
      client: {
        hl: cfg.hl,
        gl: cfg.gl,
        clientName: cfg.clientName,
        clientVersion: cfg.clientVersion,
        visitorData: cfg.visitorData,
      }
    };
  }

  // Step 1: /youtubei/v1/next 호출 → getTranscriptEndpoint params 추출
  async function getTranscriptParams(videoId, cfg) {
    console.log(TAG, 'Step 1: /next 호출로 transcript params 추출...');
    
    const resp = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${cfg.apiKey}&prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      referrer: location.href,
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': cfg.clientNameHeader,
        'X-YouTube-Client-Version': cfg.clientVersion,
        ...(cfg.visitorData ? { 'X-Goog-Visitor-Id': cfg.visitorData } : {}),
        'X-Youtube-Bootstrap-Logged-In': cfg.loggedIn ? 'true' : 'false',
      },
      body: JSON.stringify({
        context: buildContext(cfg),
        videoId: videoId,
      })
    });

    if (!resp.ok) {
      console.log(TAG, '/next API 실패:', resp.status);
      return null;
    }

    const data = await resp.json();
    
    // engagementPanels에서 getTranscriptEndpoint 찾기
    const panels = data?.engagementPanels || [];
    for (const panel of panels) {
      const content = panel?.engagementPanelSectionListRenderer?.content;
      const continuationItems = content?.continuationItemRenderer;
      
      // 방법 A: continuationItemRenderer에서 직접 찾기
      if (continuationItems?.continuationEndpoint?.getTranscriptEndpoint) {
        const params = continuationItems.continuationEndpoint.getTranscriptEndpoint.params;
        console.log(TAG, 'transcript params 발견 (continuationItem):', params?.substring(0, 50) + '...');
        return params;
      }
    }

    // 방법 B: JSON 전체에서 getTranscriptEndpoint 검색
    const jsonStr = JSON.stringify(data);
    const match = jsonStr.match(/"getTranscriptEndpoint"\s*:\s*\{[^}]*"params"\s*:\s*"([^"]+)"/);
    if (match) {
      console.log(TAG, 'transcript params 발견 (JSON 검색):', match[1].substring(0, 50) + '...');
      return match[1];
    }

    console.log(TAG, 'transcript params를 찾을 수 없음');
    return null;
  }

  // Step 2: /youtubei/v1/get_transcript 호출 → 자막 텍스트 추출
  async function fetchTranscript(videoId, params, cfg) {
    console.log(TAG, 'Step 2: /get_transcript 호출...');

    const resp = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${cfg.apiKey}&prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      referrer: location.href,
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': cfg.clientNameHeader,
        'X-YouTube-Client-Version': cfg.clientVersion,
        ...(cfg.visitorData ? { 'X-Goog-Visitor-Id': cfg.visitorData } : {}),
        'X-Youtube-Bootstrap-Logged-In': cfg.loggedIn ? 'true' : 'false',
      },
      body: JSON.stringify({
        context: buildContext(cfg),
        externalVideoId: videoId,
        params: params,
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(TAG, '/get_transcript API 실패:', resp.status, errText?.substring(0, 400));
      return null;
    }

    const data = await resp.json();
    
    // 자막 세그먼트 추출
    const body = data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.body?.transcriptBodyRenderer;
    
    if (!body) {
      console.log(TAG, 'transcriptBodyRenderer 없음, 전체 응답 키:', Object.keys(data || {}));
      // 다른 경로 시도
      const altBody = data?.actions?.[0]?.updateEngagementPanelAction?.content
        ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
        ?.transcriptSegmentListRenderer;
      if (altBody) {
        return extractSegments(altBody);
      }
      return null;
    }

    return extractSegments(body);
  }

  // 세그먼트 리스트에서 자막 아이템 추출
  function extractSegments(body) {
    const cues = body?.initialSegments || [];
    const items = [];

    for (const cue of cues) {
      const seg = cue?.transcriptSegmentRenderer;
      if (!seg) continue;

      const text = seg?.snippet?.runs?.map(r => r.text).join('') || '';
      if (!text.trim()) continue;

      const startMs = parseInt(seg?.startMs || '0', 10);
      const endMs = parseInt(seg?.endMs || '0', 10);

      items.push({
        text: text.trim(),
        start: startMs / 1000,
        duration: (endMs - startMs) / 1000,
      });
    }

    console.log(TAG, `자막 세그먼트 ${items.length}개 추출`);
    return items.length > 0 ? items : null;
  }

  // content script에서 요청이 오면 처리
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'AGGRO_MAIN_WORLD_REQUEST') return;

    const { requestId, action } = event.data;
    let result = null;

    try {
      if (action === 'GET_TRANSCRIPT') {
        const videoId = event.data.videoId;
        if (!videoId) {
          console.log(TAG, 'videoId 없음');
          result = { items: null, error: 'no videoId' };
        } else {
          const cfg = getInnertubeConfig();
          if (!cfg?.apiKey) {
            console.log(TAG, 'ytcfg 없음');
            result = { items: null, error: 'no ytcfg' };
          } else {
            console.log(TAG, `videoId: ${videoId}, apiKey: ${cfg.apiKey.substring(0, 10)}...`);
            
            // Step 1: transcript params 가져오기
            const params = await getTranscriptParams(videoId, cfg);
            
            if (!params) {
              result = { items: null, error: 'no transcript params' };
            } else {
              // Step 2: 자막 가져오기
              const items = await fetchTranscript(videoId, params, cfg);
              result = { items: items, error: items ? null : 'no segments' };
            }
          }
        }
      }

      if (action === 'GET_YTCFG') {
        const cfg = getInnertubeConfig();
        result = cfg;
      }
    } catch (e) {
      console.error(TAG, '오류:', e);
      result = { items: null, error: e.message };
    }

    window.postMessage({
      type: 'AGGRO_MAIN_WORLD_RESPONSE',
      requestId: requestId,
      payload: result,
    }, '*');
  });

  console.log(TAG, '로드 완료');
})();
