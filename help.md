# 작업 요지 (Smart Chunking + 분석 실패(500) 원인)

이 문서는 분석 페이지의 AI 요약 품질을 개선하기 위해 적용한 **Smart Chunking(스마트 청킹)** 로직과, 작업 중 발생했던 **분석 요청 500 에러의 실제 원인/해결**을 요약한 메모입니다.

## 1) 목표

- 기존 문제: 자막 전문을 그대로 AI에 전달하면 문맥을 무시하고 기계적으로 끊기거나(분 단위/글자수 단위) 요약이 반쪽만 되는 현상이 발생
- 개선 목표: 자막을 **의미 단위(문단/챕터)** 로 나눈 뒤, 각 구간을 **1문장 요약**하고, 이를 **타임스탬프와 함께 합쳐** `subtitleSummary` 품질을 올림

## 2) 핵심 아이디어 (침묵 기반 문단 구분)

- 자막 원본이 `[{ text, start, duration }]` 형태로 있을 때
  - 앞 문장의 끝 = `start + duration`
  - 다음 문장의 시작 = `next.start`
  - 갭(gap) = `next.start - (start + duration)`
  - **gap >= 1.5초** 이면 문단/챕터 전환(침묵 구간)으로 보고 청크 분리

## 3) 적용된 코드 변경 요약

### A. `lib/youtube.ts`

- `getTranscriptItems(videoId)` 추가
  - `youtube-transcript-plus` 결과(줄 단위 자막)에 포함된 `offset`/`duration`을 유지한 채 배열로 반환
- `getTranscript(videoId)`는 내부적으로 `getTranscriptItems()`를 사용해 기존처럼 문자열을 만들되, **시간 정보는 items에서 확보**할 수 있게 함

### B. `app/api/analysis/request/route.ts`

- 자막 추출 시:
  - 우선 `getTranscriptItems()`로 items를 가져오고
  - `transcriptItems = [{ text, start: offset, duration }]` 형태로 변환
  - DB 저장용 `transcript` 문자열은 items의 text를 join하여 생성
- Gemini 호출 시:
  - `analyzeContent(..., duration, transcriptItems)` 로 **시간 포함 items를 추가 전달**

### C. `lib/gemini.ts`

- `analyzeContent()` 시그니처 확장:
  - `transcriptItems?: { text: string; start: number; duration: number }[]` 인자 추가
- 시간 기반 청킹 함수 추가:
  - `chunkTranscriptItems()` : gap(>=1.5s) 기반으로 청크 생성
  - 타임스탬프 포맷: `m:ss`
- 청크별 1문장 요약:
  - 각 청크를 `summarizeChunk()`로 1문장 요약 → `subtitleSummaryOverride`로 합쳐 최종 `subtitleSummary`를 덮어씀
- 실행 안정성(시간/호출수) 개선:
  - 청크가 너무 많으면 Gemini 호출이 청크 수만큼 발생하여 API 라우트가 60초 내에 끝나지 않을 수 있음
  - 이를 방지하기 위해 `coalesceChunks(rawChunks, 12)`로 **최대 12개 청크로 병합** 후 요약 호출

## 4) 분석 요청 500 에러의 실제 원인 (중요)

- `/api/analysis/request` 500의 실제 응답:
  - `null value in column "f_name" of relation "t_channels" violates not-null constraint`
- 원인:
  - `t_channels` insert 시 채널명으로 `videoInfo.channelTitle`을 사용했는데,
  - `getVideoInfo()`의 반환 필드는 `channelName`이라서 `undefined -> null`이 들어가 DB not-null 제약 위반
- 해결:
  - `videoInfo.channelTitle` → `videoInfo.channelName`로 수정

## 5) 참고/주의

- API 라우트 코드 수정 후에도 동일 에러가 계속 나오면, dev 서버가 변경을 반영하지 못한 상태일 수 있으니 **서버 재시작**이 필요할 수 있음
- Gemini API는 상황에 따라 503(과부하)/429(레이트리밋) 가능성이 있어, 청크 호출 수 제한이 필수적인 방어 장치임
