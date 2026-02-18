# AggroFilter Chrome Extension - 작업 현황 정리

## 현재 상태 (2026-02-19 최신, commit: dd9adae)

### ✅ 이번 세션에서 완료된 것 (commit: dd9adae)

- **Shorts 자막 추출 성공**: ANDROID context 폴백으로 captionTracks 확보 → xml/srv3 파싱 성공
- **버튼 삽입 안정화**: 네비게이션 이벤트 디바운스 + retryInsert 세션 ID 취소 토큰
- **분석 API 504 수정**: gemini-2.5-flash 18초 타임아웃 + Netlify timeout=26 설정
- **일반 /watch 영상**: 버튼 삽입 + 자막 추출 + 분석 모두 정상

### ⚠️ 남은 이슈

- **분석 API 504 재발 가능성**: gemini-2.5-flash가 18초 초과 시 분석 실패 (에러 메시지 반환)
  - 근본 해결: Vercel로 이전 (maxDuration=300 지원) 또는 Gemini 응답 스트리밍 구현
- **Shorts 자막 없는 영상**: captionTracks 0개 → 자막 추출 불가 (정상 동작, 자막 자체가 없는 것)

---

## 자막 추출 동작 방식 (현재 확정)

### 성공 경로 (Shorts)
```
Step 1: /next → transcript params 발견 (WEB context) ✅
Step 2: /get_transcript [WEB] → 400 FAILED_PRECONDITION ❌
Step 2: /get_transcript [MWEB] → 400 FAILED_PRECONDITION ❌
Step 2: /get_transcript [ANDROID] → 응답 파싱 실패 (구조 다름) ❌
captionTracks /player [WEB] → 0개 ❌
captionTracks /player [MWEB] → 0개 ❌
captionTracks /player [ANDROID] → 1개 ✅
caption track URL 파싱 (xml/srv3) → 세그먼트 추출 ✅
```

### /get_transcript ANDROID 응답 구조 미파악
- ANDROID context로 `/get_transcript` 호출 시 200 응답이 오지만 파싱 실패
- 응답 키: `Array(4)` (actions 구조가 다를 가능성)
- 다음 세션에서 ANDROID 응답 구조 로깅 후 파싱 로직 추가 가능

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `chrome-extension/main-world.js` | innertube API 호출, 자막 추출 핵심 로직 |
| `chrome-extension/content.js` | 버튼 삽입, 자막 추출 조율, 네비게이션 감지 |
| `chrome-extension/content.css` | 버튼 스타일 (Shorts 전용: `.shorts-mode`) |
| `lib/gemini.ts` | Gemini AI 분석 (gemini-2.5-flash, 18초 타임아웃) |
| `netlify.toml` | Netlify 배포 설정 (timeout=26) |

## 핵심 함수 위치 (main-world.js)

- `getTranscriptParams(videoId, cfg)`: `/next` 호출 → params 추출
- `fetchTranscriptWithContext(...)`: `/get_transcript` 단일 context 호출
- `fetchTranscript(videoId, params, cfg)`: WEB→MWEB→ANDROID 순차 시도
- `fetchPlayerWithContext(...)`: `/player` 단일 context 호출
- `fetchCaptionTracksFromPlayerApi(videoId, cfg)`: WEB→MWEB→ANDROID 순차 시도
- `extractCaptionTrackUrls(videoId, cfg)`: /player API 우선, ytInitialPlayerResponse 폴백
- `fetchTranscriptFromCaptionTrackFallback(videoId, cfg)`: caption track URL 파싱 (json3/xml/srv3/vtt)

## innertube clientName 참고값

| clientName | clientNameHeader | 용도 |
|------------|-----------------|------|
| `WEB` | `1` | 기본 (get_transcript 400) |
| `MWEB` | `2` | 모바일 웹 (get_transcript 400) |
| `ANDROID` | `3` | Android (player captionTracks 성공) |
| `IOS` | `5` | iOS 앱 (미시도) |

## 다음 세션 시도 대상 (선택)

### ANDROID /get_transcript 응답 구조 파악
```javascript
// main-world.js fetchTranscript 함수에서 ANDROID 응답 로깅 추가
console.log(TAG, '/get_transcript [ANDROID] 전체 응답:', JSON.stringify(data).substring(0, 500));
```
- 응답 키 `Array(4)` 내부 구조 확인 후 파싱 로직 추가하면
  caption track URL 호출 없이 바로 자막 추출 가능 (더 빠름)

### 분석 API 504 근본 해결
- Vercel로 이전: `maxDuration = 300` 지원, 타임아웃 문제 완전 해결
- 또는 Gemini 응답 스트리밍: 첫 토큰 수신 시 클라이언트에 응답 시작
