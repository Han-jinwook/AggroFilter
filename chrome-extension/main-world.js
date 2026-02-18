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
  async function fetchTranscriptWithContext(params, clientName, clientNameHeader, clientVersion, apiKey, cfg) {
    const context = {
      client: {
        hl: cfg.hl,
        gl: cfg.gl,
        clientName,
        clientVersion,
        ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {}),
      }
    };
    const resp = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}&prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      referrer: location.href,
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': clientNameHeader,
        'X-YouTube-Client-Version': clientVersion,
        ...(cfg.visitorData ? { 'X-Goog-Visitor-Id': cfg.visitorData } : {}),
        'X-Youtube-Bootstrap-Logged-In': cfg.loggedIn ? 'true' : 'false',
      },
      body: JSON.stringify({ context, params })
    });
    return resp;
  }

  function parseTranscriptResponse(data) {
    const body = data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.body?.transcriptBodyRenderer;
    if (body) return extractSegments(body);

    const altBody = data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
      ?.transcriptSegmentListRenderer;
    if (altBody) return extractSegments(altBody);

    return null;
  }

  async function fetchTranscript(videoId, params, cfg) {
    const clientContexts = [
      { name: 'WEB',     header: cfg.clientNameHeader, version: cfg.clientVersion },
      { name: 'MWEB',    header: '2',                  version: '2.20240101.00.00' },
      { name: 'ANDROID', header: '3',                  version: '19.09.37' },
    ];

    for (const ctx of clientContexts) {
      try {
        console.log(TAG, `Step 2: /get_transcript 호출 [${ctx.name}]...`);
        const resp = await fetchTranscriptWithContext(params, ctx.name, ctx.header, ctx.version, cfg.apiKey, cfg);

        if (!resp.ok) {
          const errText = await resp.text();
          console.log(TAG, `/get_transcript [${ctx.name}] 실패:`, resp.status, errText?.substring(0, 200));
          continue;
        }

        const data = await resp.json();
        const items = parseTranscriptResponse(data);
        if (items && items.length > 0) {
          console.log(TAG, `/get_transcript [${ctx.name}] 성공: ${items.length}개`);
          return items;
        }
        console.log(TAG, `/get_transcript [${ctx.name}] 응답 파싱 실패, 응답 키:`, Object.keys(data || {}));
      } catch (e) {
        console.log(TAG, `/get_transcript [${ctx.name}] 예외:`, e?.message || e);
      }
    }

    return null;
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

  function parseJsonSafely(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/^\)\]\}'\s*/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  function decodeXmlEntities(text) {
    if (!text) return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#10;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripXmlTags(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '');
  }

  function extractXmlSegmentsFromText(raw) {
    if (!raw) return null;
    const items = [];

    // timedtext 기본 포맷: <text start=".." dur="..">...</text>
    const textNodePattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
    let match;

    while ((match = textNodePattern.exec(raw)) !== null) {
      const attrs = match[1] || '';
      const content = decodeXmlEntities(match[2] || '');
      if (!content) continue;

      const startMatch = attrs.match(/\bstart="([0-9.]+)"/i);
      const durMatch = attrs.match(/\bdur="([0-9.]+)"/i);

      items.push({
        text: content,
        start: Number(startMatch?.[1] || 0),
        duration: Number(durMatch?.[1] || 0),
      });
    }

    // srv3 포맷: <p t="1234" d="5678">...<s>...</s>...</p>
    const pNodePattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    while ((match = pNodePattern.exec(raw)) !== null) {
      const attrs = match[1] || '';
      const plain = decodeXmlEntities(stripXmlTags(match[2] || ''));
      if (!plain) continue;

      const startMatch = attrs.match(/\bt="([0-9.]+)"/i);
      const durMatch = attrs.match(/\bd="([0-9.]+)"/i);
      const beginMatch = attrs.match(/\bbegin="([^"]+)"/i);
      const endMatch = attrs.match(/\bend="([^"]+)"/i);

      // srv3의 t/d는 밀리초 단위인 경우가 대부분
      const startMs = Number(startMatch?.[1] || 0);
      const durMs = Number(durMatch?.[1] || 0);

      // TTML 포맷(begin/end)이면 초 단위 계산
      if (beginMatch || endMatch) {
        const startSec = parseSubtitleTime(beginMatch?.[1] || '0');
        const endSec = parseSubtitleTime(endMatch?.[1] || '0');
        items.push({
          text: plain,
          start: startSec,
          duration: Math.max(0, endSec - startSec),
        });
        continue;
      }

      items.push({
        text: plain,
        start: startMs / 1000,
        duration: durMs / 1000,
      });
    }

    return items.length > 0 ? items : null;
  }

  function parseSubtitleTime(ts) {
    // 00:01.234, 00:00:01.234, 00:00:01,234, 1.23s, 1234ms
    if (!ts) return 0;
    const t = ts.trim();

    if (/ms$/i.test(t)) {
      const ms = Number(t.replace(/ms$/i, ''));
      return Number.isFinite(ms) ? ms / 1000 : 0;
    }
    if (/s$/i.test(t)) {
      const sec = Number(t.replace(/s$/i, ''));
      return Number.isFinite(sec) ? sec : 0;
    }

    const normalized = t.replace(',', '.');
    const parts = normalized.split(':').map((p) => p.trim());
    if (parts.length === 2) {
      const mm = Number(parts[0]);
      const ss = Number(parts[1]);
      if (!Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
      return mm * 60 + ss;
    }
    if (parts.length === 3) {
      const hh = Number(parts[0]);
      const mm = Number(parts[1]);
      const ss = Number(parts[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
      return hh * 3600 + mm * 60 + ss;
    }
    return 0;
  }

  function extractVttSegments(raw) {
    if (!raw || !/WEBVTT/i.test(raw)) return null;
    const lines = raw.replace(/\r/g, '').split('\n');
    const items = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      const timeMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{1,3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?[\.,]\d{1,3})/);
      if (!timeMatch) {
        i++;
        continue;
      }

      const start = parseSubtitleTime(timeMatch[1]);
      const end = parseSubtitleTime(timeMatch[2]);
      i++;

      const textLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].replace(/<[^>]+>/g, ''));
        i++;
      }

      const text = decodeXmlEntities(textLines.join(' ').replace(/\s+/g, ' ').trim());
      if (text) {
        items.push({
          text,
          start,
          duration: Math.max(0, end - start),
        });
      }
    }

    return items.length > 0 ? items : null;
  }

  function normalizeCaptionTrackUrl(url, fmt) {
    if (!url) return null;
    try {
      const u = new URL(url, location.origin);
      if (fmt) {
        u.searchParams.set('fmt', fmt);
      }
      return u.toString();
    } catch {
      return null;
    }
  }

  function buildCaptionTrackCandidates(tracks) {
    if (!tracks || tracks.length === 0) return [];

    const preferredTrack =
      tracks.find((t) => t?.languageCode === 'ko' || (t?.vssId || '').includes('.ko')) ||
      tracks[0];

    const baseUrl = preferredTrack?.baseUrl;
    const candidates = [
      normalizeCaptionTrackUrl(baseUrl, null),   // 원본
      normalizeCaptionTrackUrl(baseUrl, 'json3'),
      normalizeCaptionTrackUrl(baseUrl, 'srv3'),
      normalizeCaptionTrackUrl(baseUrl, 'vtt'),
    ].filter(Boolean);

    return [...new Set(candidates)];
  }

  async function fetchPlayerWithContext(videoId, clientName, clientNameHeader, clientVersion, cfg) {
    const context = {
      client: {
        hl: cfg.hl,
        gl: cfg.gl,
        clientName,
        clientVersion,
        ...(cfg.visitorData ? { visitorData: cfg.visitorData } : {}),
      }
    };
    const resp = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${cfg.apiKey}&prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      referrer: location.href,
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': clientNameHeader,
        'X-YouTube-Client-Version': clientVersion,
        ...(cfg.visitorData ? { 'X-Goog-Visitor-Id': cfg.visitorData } : {}),
        'X-Youtube-Bootstrap-Logged-In': cfg.loggedIn ? 'true' : 'false',
      },
      body: JSON.stringify({ context, videoId }),
    });
    if (!resp.ok) return null;
    return resp.json();
  }

  async function fetchCaptionTracksFromPlayerApi(videoId, cfg) {
    const clientContexts = [
      { name: 'WEB',     header: cfg.clientNameHeader, version: cfg.clientVersion },
      { name: 'MWEB',    header: '2',                  version: '2.20240101.00.00' },
      { name: 'ANDROID', header: '3',                  version: '19.09.37' },
    ];

    for (const ctx of clientContexts) {
      try {
        console.log(TAG, `captionTracks /player 시도: clientName=${ctx.name}`);
        const data = await fetchPlayerWithContext(videoId, ctx.name, ctx.header, ctx.version, cfg);
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        console.log(TAG, `captionTracks /player [${ctx.name}] 결과: ${tracks.length}개`);
        if (tracks.length > 0) return tracks;
      } catch (e) {
        console.log(TAG, `captionTracks /player [${ctx.name}] 예외:`, e?.message || e);
      }
    }

    return [];
  }

  async function extractCaptionTrackUrls(videoId, cfg) {
    // SPA 전환 후 ytInitialPlayerResponse는 stale URL을 가질 수 있으므로
    // 항상 /player API를 먼저 호출해 fresh captionTracks URL을 확보
    const apiTracks = await fetchCaptionTracksFromPlayerApi(videoId, cfg);
    if (apiTracks.length > 0) {
      return buildCaptionTrackCandidates(apiTracks);
    }

    // /player API 실패 시에만 ytInitialPlayerResponse 폴백 사용
    const initialTracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (initialTracks.length > 0) {
      console.log(TAG, 'captionTracks: ytInitialPlayerResponse 폴백 사용 (stale 가능성 있음)');
      return buildCaptionTrackCandidates(initialTracks);
    }

    return [];
  }

  function parseCaptionTrackPayload(raw) {
    const parsed = parseJsonSafely(raw);
    if (parsed) {
      const jsonItems = extractJson3Segments(parsed);
      if (jsonItems && jsonItems.length > 0) {
        return { items: jsonItems, mode: 'json3' };
      }
    }

    const xmlItems = extractXmlSegmentsFromText(raw);
    if (xmlItems && xmlItems.length > 0) {
      return { items: xmlItems, mode: 'xml/srv3' };
    }

    const vttItems = extractVttSegments(raw);
    if (vttItems && vttItems.length > 0) {
      return { items: vttItems, mode: 'vtt' };
    }

    return null;
  }

  function extractJson3Segments(data) {
    const events = data?.events || [];
    const items = [];

    for (const ev of events) {
      const text = ev?.segs?.map((s) => s?.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      const startMs = Number(ev?.tStartMs || 0);
      const durationMs = Number(ev?.dDurationMs || 0);
      items.push({
        text,
        start: startMs / 1000,
        duration: durationMs / 1000,
      });
    }

    return items.length > 0 ? items : null;
  }

  async function fetchTranscriptFromCaptionTrackFallback(videoId, cfg) {
    const trackUrls = await extractCaptionTrackUrls(videoId, cfg);
    if (!trackUrls.length) {
      console.log(TAG, 'captionTracks 없음 (fallback 실패)');
      return null;
    }

    console.log(TAG, `Step 1 fallback: caption track 호출 시도 (${trackUrls.length}개 URL)`);

    for (const trackUrl of trackUrls) {
      try {
        const resp = await fetch(trackUrl, {
          method: 'GET',
          credentials: 'include',
          referrer: location.href,
        });

        if (!resp.ok) {
          console.log(TAG, 'caption track 호출 실패:', resp.status, trackUrl.slice(0, 120));
          continue;
        }

        const raw = await resp.text();
        const contentType = resp.headers.get('content-type') || 'unknown';
        const parsed = parseCaptionTrackPayload(raw);
        if (parsed?.items?.length) {
          console.log(TAG, `fallback(${parsed.mode}) 자막 세그먼트 ${parsed.items.length}개 추출`);
          return parsed.items;
        }

        console.log(
          TAG,
          'caption 파싱 실패 샘플:',
          `content-type=${contentType}, head=${raw.slice(0, 160).replace(/\s+/g, ' ')}`
        );
      } catch (e) {
        console.log(TAG, 'caption track 호출 예외:', e?.message || e);
      }
    }

    console.log(TAG, 'caption fallback 파싱 실패 (json3/xml/srv3/vtt)');

    return null;
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
              const fallbackItems = await fetchTranscriptFromCaptionTrackFallback(videoId, cfg);
              result = { items: fallbackItems, error: fallbackItems ? null : 'no transcript params' };
            } else {
              // Step 2: 자막 가져오기
              let items = await fetchTranscript(videoId, params, cfg);

              // get_transcript 결과가 비어있으면 caption track fallback 시도
              if (!items || items.length === 0) {
                items = await fetchTranscriptFromCaptionTrackFallback(videoId, cfg);
              }

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
