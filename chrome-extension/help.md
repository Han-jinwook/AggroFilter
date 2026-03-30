# AggroFilter Chrome Extension — 미해결 이슈
> 작업 완료 기록은 `plan.md` 참조 (§17, §18)

## ⚠️ 미해결 이슈 (2026-03-30 기준)

### 1. 분석 API 504 재발 가능성
- Netlify 함수 타임아웃 26초, gemini-2.5-flash 18초 제한
- 긴 자막 + thinking 시 초과 가능
- **해결 방안**: Vercel 이전 (`maxDuration=300`) 또는 Gemini 응답 스트리밍

### 2. ANDROID `/get_transcript` 응답 구조 미파악
- 200 응답이 오지만 파싱 실패 (actions 구조가 WEB과 다름)
- 해결 시 caption track URL 호출 없이 바로 자막 추출 가능 (속도 개선)
```javascript
// 디버깅용: main-world.js fetchTranscript 함수에서
console.log(TAG, '/get_transcript [ANDROID] 전체 응답:', JSON.stringify(data).substring(0, 500));
```

---

## 참고: 핵심 함수 위치 (main-world.js)

| 함수 | 역할 |
|------|------|
| `getTranscriptParams` | `/next` → transcript params 추출 |
| `fetchTranscript` | WEB→MWEB→ANDROID 순차 시도 |
| `extractCaptionTrackUrls` | 5단계 폴백 (player API → 런타임 → page fetch → timedtext → deep search) |
| `fetchTranscriptFromCaptionTrackFallback` | caption track URL 파싱 (json3/xml/srv3/vtt) |

## 참고: innertube clientName

| clientName | header | 용도 |
|------------|--------|------|
| `WEB` | `1` | 기본 |
| `MWEB` | `2` | 모바일 웹 |
| `ANDROID` | `3` | Android (captionTracks 성공률 높음) |
| `IOS` | `5` | iOS (미시도) |
