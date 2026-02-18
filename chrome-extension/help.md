# AggroFilter Chrome Extension - Shorts 자막 추출 문제 정리

## 현재 상태 (2026-02-18)

### ✅ 정상 동작
- 일반 YouTube `/watch` 영상: 버튼 삽입 + 자막 추출 모두 정상
- Shorts 버튼 삽입: `text-match (구독)` 방식으로 정상 삽입 중
- Shorts 페이지 전환 시 버튼 재삽입: 정상

### ❌ 실패 중인 것
- **Shorts 자막 추출**: 모든 방법 실패

---

## 자막 추출 실패 원인 분석

### 실패 경로 (로그 기준)

```
Step 1: /next → transcript params 발견 ✅
Step 2: /get_transcript → 400 FAILED_PRECONDITION ❌
captionTracks 폴백: /player 호출 → 결과 0개 ❌
ytInitialPlayerResponse 폴백 → stale URL → text/html 응답 ❌
```

### 원인 1: `/get_transcript` 400 에러
- `/next`에서 `getTranscriptEndpoint.params`를 찾아도 `/get_transcript` 호출 시 400 반환
- 에러: `"Precondition check failed."` / `FAILED_PRECONDITION`
- **가설**: Shorts용 params는 일반 영상과 다른 context가 필요할 수 있음
  - Shorts는 `clientName: MWEB` 또는 `clientName: ANDROID` context가 필요할 수 있음
  - 현재 코드는 `WEB` context로 `/get_transcript` 호출 중

### 원인 2: `/player` API captionTracks 0개
- `J9Tompr5qUA` 영상은 `/player` API에서도 captionTracks가 없음
- **가설 A**: 이 영상 자체에 자막이 없음 (자막 없는 영상)
- **가설 B**: Shorts는 `/player` 호출 시 `clientName: ANDROID` 또는 `MWEB`이 필요

### 원인 3: `ytInitialPlayerResponse` stale URL
- SPA 전환 후 `ytInitialPlayerResponse`는 갱신되지 않아 만료된 URL 보유
- 만료된 URL → `text/html` 응답 → 파싱 실패
- 이건 `/player` API가 성공하면 자동 해결됨

---

## 다음 세션에서 시도할 것

### 시도 1: Shorts 전용 client context로 `/get_transcript` 재시도
```javascript
// main-world.js의 fetchTranscript 함수에서
// Shorts URL일 때 clientName을 MWEB 또는 ANDROID로 변경해 재시도
const isShorts = location.pathname.startsWith('/shorts/');
if (isShorts) {
  // MWEB context로 재시도
  const mwebCfg = { ...cfg, clientName: 'MWEB', clientVersion: '2.20240101.00.00', clientNameHeader: '2' };
  // 또는 ANDROID
  const androidCfg = { ...cfg, clientName: 'ANDROID', clientVersion: '19.09.37', clientNameHeader: '3' };
}
```

### 시도 2: `/player` 호출 시 Shorts 전용 client 사용
```javascript
// fetchCaptionTracksFromPlayerApi에서 Shorts일 때 MWEB/ANDROID context 사용
const isShorts = location.pathname.startsWith('/shorts/');
const clientName = isShorts ? 'MWEB' : cfg.clientName;
const clientNameHeader = isShorts ? '2' : cfg.clientNameHeader;
```

### 시도 3: 자막 있는 Shorts 영상으로 먼저 검증
- 테스트 전에 YouTube에서 자막 있는 Shorts 영상 확인 방법:
  1. Shorts 영상 재생
  2. 우하단 `CC` 버튼이 있으면 자막 있는 영상
  3. 또는 `...` 메뉴 → "자막" 항목 있으면 자막 있음
- 자막 없는 영상(`J9Tompr5qUA`)으로 계속 테스트하면 항상 실패

### 시도 4: `/next` params를 다른 client로 재요청
```javascript
// /next 호출 시 Shorts 전용 context 사용
// MWEB clientName: 'MWEB', clientNameHeader: '2'
// ANDROID clientName: 'ANDROID', clientNameHeader: '3'
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `chrome-extension/main-world.js` | innertube API 호출, 자막 추출 핵심 로직 |
| `chrome-extension/content.js` | 버튼 삽입, 자막 추출 조율 |
| `chrome-extension/content.css` | 버튼 스타일 (Shorts 전용: `.shorts-mode`) |

## 핵심 함수 위치 (main-world.js)

- `getTranscriptParams(videoId, cfg)`: `/next` 호출 → params 추출
- `fetchTranscript(videoId, params, cfg)`: `/get_transcript` 호출
- `fetchCaptionTracksFromPlayerApi(videoId, cfg)`: `/player` 호출 → captionTracks
- `extractCaptionTrackUrls(videoId, cfg)`: captionTracks URL 수집 (API 우선)
- `fetchTranscriptFromCaptionTrackFallback(videoId, cfg)`: caption track 파싱 폴백

## innertube clientName 참고값

| clientName | clientNameHeader | 용도 |
|------------|-----------------|------|
| `WEB` | `1` | 현재 사용 중 |
| `MWEB` | `2` | 모바일 웹 |
| `ANDROID` | `3` | Android 앱 |
| `IOS` | `5` | iOS 앱 |
| `TVHTML5` | `7` | TV |
| `WEB_EMBEDDED_PLAYER` | `56` | 임베드 플레이어 |

## 현재 코드 상태 요약 (2026-02-18 최신)

```
/next → params 발견 (WEB context) ✅
/get_transcript → 400 (WEB context) ❌ (MWEB/ANDROID 시도 미구현 - 다음 시도 대상)
/player → WEB→MWEB→ANDROID 순차 시도 ✅ (구현됨, 아직 결과 미확인)
caption URL 파싱 → text/html (stale URL) ❌ → /player 성공 시 해결됨
```

### 최신 구현 내용 (main-world.js)

`fetchCaptionTracksFromPlayerApi` 함수가 WEB → MWEB → ANDROID 순서로 `/player` API를 시도합니다.

```javascript
const clientContexts = [
  { name: 'WEB',     header: cfg.clientNameHeader, version: cfg.clientVersion },
  { name: 'MWEB',    header: '2',                  version: '2.20240101.00.00' },
  { name: 'ANDROID', header: '3',                  version: '19.09.37' },
];
```

### 다음 세션에서 확인할 로그

```
captionTracks /player [WEB] 결과: N개
captionTracks /player [MWEB] 결과: N개
captionTracks /player [ANDROID] 결과: N개
```

- 모두 0개면 → 해당 Shorts 영상에 자막이 없는 것 (자막 있는 영상으로 테스트 필요)
- N개 이상이면 → caption URL 파싱 시도 (json3/xml/srv3/vtt)

### 중요: 테스트 영상 선택 방법

**자막 없는 영상으로 테스트하면 항상 실패합니다.**

자막 있는 Shorts 영상 확인 방법:
1. Shorts 재생 중 우하단 `CC` 버튼 있으면 자막 있음
2. 또는 `...` 메뉴 → "자막" 항목 있으면 자막 있음
3. 뉴스 채널(JTBC, MBC 등) Shorts는 자막이 있는 경우가 많음

### 미구현 - 다음 세션 시도 대상

`/get_transcript` 호출 시 MWEB/ANDROID context 재시도:
```javascript
// fetchTranscript 함수 내부에서 400 실패 시 다른 context로 재시도
const altContexts = [
  { name: 'MWEB', header: '2', version: '2.20240101.00.00' },
  { name: 'ANDROID', header: '3', version: '19.09.37' },
];
for (const ctx of altContexts) {
  const altResp = await fetch('/youtubei/v1/get_transcript?...', {
    body: JSON.stringify({
      context: { client: { clientName: ctx.name, clientVersion: ctx.version, ... } },
      params,
    })
  });
  if (altResp.ok) { /* 파싱 */ }
}
```
