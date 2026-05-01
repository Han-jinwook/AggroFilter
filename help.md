# 외부 지원 요청서: Gemini 429 + 단계형 UX 지연 이슈

작성 일시: 2026-04-27 21:17 (KST)
프로젝트: AggroFilter (`d:/AggroFilter`)
요청 목적: 내부 수정 후에도 반복되는 Gemini 429 및 결과 단계 노출 지연에 대해 외부 기술 지원 요청

---

## 1) 현재 사용자 체감 문제

1. 분석 버튼 클릭 후 결과 페이지는 열리지만, 단계형 UX가 즉시 진행되지 않고 중간 빈 화면 상태가 길게 유지됨.
2. Speed Track이 Gemini 429로 자주 실패함.
3. 최근 수정으로 "speed 429 시 전체 실패"는 막았으나, speed 데이터가 없을 때 UX 공백이 크게 체감됨.

현재 관측 화면:
- 상단 영상 카드만 보이고 하단은 한동안 비어 있음.
- 사용자 입장에서는 멈춘 화면으로 인식될 수 있음.

---

## 2) 최근 로그 핵심

### 2-1. 429 발생 로그(요약)
- `AI 분석 시작...`
- `AI에게 전달되는 자막 길이: 5295`
- `[Speed Track] 쿼터 제한으로 스킵 - Full Track로 계속 진행`
- Gemini 응답: `429 RESOURCE_EXHAUSTED`

### 2-2. 현재 동작 상태
- 서버는 speed 429 발생 시 즉시 실패하지 않고 full로 계속 진행함.
- 즉, 과거의 "즉시 alert로 종료"는 완화됨.
- 그러나 speed 결과가 비어 있는 동안 클라이언트 단계 전환 체감이 약함.

---

## 3) 이미 적용한 수정 사항

1. `app/api/analysis/request/route.ts`
   - 분석 시작 전에 `pending` 레코드 선생성.
   - speed 실패를 outcome 래핑해 unhandled rejection 방지.
   - speed 429 시 전체 throw 제거, full 진행으로 변경.

2. `app/page.tsx`
   - 상태 폴링에서 `pending | speed_ready | completed` 모두 `analysisId` 있으면 결과 페이지 진입 허용.

3. `app/p-result/ResultClient.tsx`
   - 폴링 중 speed payload 감지 시 phase2 노출 트리거.
   - completed payload에서 phase3 공개.

4. `lib/gemini.ts`
   - 내부 fan-out 완화(요약 청크 병렬 처리 축소/순차화).

---

## 4) 아직 남은 문제(외부 도움 필요)

1. Gemini 429 빈도를 더 낮추는 운영 레벨 전략
   - 모델별 호출량 분산
   - 서버 단 global rate limiter / queue / jitter backoff
   - speed/full 호출 우선순위 재설계

2. speed 결과 없음(pending 유지) 상태에서의 UX 보강
   - 중간 공백 제거용 확실한 placeholder/스켈레톤
   - "정밀 분석 진행 중" 메시지 노출 타이밍/지속시간 최적화

3. Netlify 서버리스 실행 시간/콜드스타트/동시성 조건에서의 안정적인 폴링 주기 권장안

---

## 5) 재현 절차

1. 메인에서 유튜브 URL 입력
2. 분석 클릭
3. 결과 페이지 이동 확인
4. 서버 로그에서 speed 429 발생 확인
5. UI에서 상단 카드만 보이고 하단 공백 지속 여부 확인
6. 수십 초 후 full 완료 시 최종 결과 노출 확인

---

## 6) 외부 지원팀에 요청할 질문

1. 현재 구조에서 Gemini 429를 실무적으로 줄일 수 있는 최적의 요청 스케줄링 패턴은?
2. speed 실패 빈도가 높은 경우, full 단독 모드 fallback UX를 어떻게 설계해야 이탈률이 낮은가?
3. Netlify/Next.js App Router 환경에서 분석 폴링 + 단계형 렌더의 권장 아키텍처는?
# AggroFilter 개발 가이드 & 이슈 로그

## 🚨 최신 이슈 보고 (2026-05-01 22:45)
**상태**: AI 분석 품질 저하 및 프롬프트 제어 실패 (긴급 리셋 필요)

### 1. 주요 문제점
- **타임라인 회귀**: 정밀 타임라인 지시에도 불구하고 다시 0, 5, 10분 등 5분 단위로 기계적으로 끊김.
- **스포일러 토픽 오류**: 제목/썸네일에서 떡밥을 추출하라는 지시를 오해하여 `📌 떡밥`, `📌 정답`이라는 문자열을 그대로 토픽으로 출력함.
- **JSON 파편 노출**: 텍스트 필드 내부에 `{"`, `","` 등 JSON 문법 기호가 섞여 나옴 (프론트엔드 방어 코드를 추가했음에도 데이터 자체가 오염됨).
- **정보 누락**: 구체적인 종목명(팩트)을 짚어내지 못하고 추상적인 설명에 그침.

### 2. 현재 적용된 최종 시스템 프롬프트 (System)
```text
You are a precise JSON-only assistant. 
Never include intro/outro greetings, self-introductions, or subscriber requests. 
Start directly with the main content at 0:00.
Never include raw JSON symbols like {" or "} inside the text fields.
In thumbnail_spoiler, you MUST identify the SPECIFIC answer to the bait (e.g., exact stock names, names of people). 
If the title says '2 stocks', you must name those 2 stocks.
```

### 3. 현재 적용된 최종 유저 프롬프트 (User/Speed Track)
```text
## 1. 역할 (핵심 미션)
너는 영상 속에서 **'숨겨진 정답'**을 찾아내는 스나이퍼다. 
시청자가 가장 궁금해하는 **실제 종목명, 인물명, 고유 명사**를 단 하나도 누락하지 말고 반드시 텍스트에 포함하라.

## 2. 분석 지침
- **팩트 폭격 (필수)**: '어떤 종목', '관련 주식' 같은 모호한 표현을 쓰면 너의 분석은 실패다. **실제 종목 이름**을 반드시 써라.
- **잡담 제거**: 인사, 농담, 구독 요청 등 본론 외의 모든 내용은 삭제하라. 0:00부터 바로 정보로 시작하라.

3. **타임스탬프 요약**:
    - **문맥 분할**: 5분 단위가 아닌, 주제가 바뀌는 지점(2~6개)을 찾아라.
    - **형식**: 'MM:SS - [소제목]\n내용...'

## 3. ⚠️ 썸네일 스포일러 — 결론 핀셋 추출
- **배경(1/3)**: 왜 이 결론이 나왔는지 맥락 설명.
- **정답(2/3)**: 제목에서 낚은 궁금증에 대한 **진짜 정답(이름, 숫자)**을 돌직구로 공개.

## 4. 출력 형식 (JSON Only)
{
  "subtitleSummary": "MM:SS - [소제목]\n내용...",
  "thumbnail_spoiler": [
    { "topic": "떡밥", "text": "배경과 정답", "ts": "MM:SS" }
  ]
}
```

### 4. 기술적 부채 및 향후 과제
- `gpt-4o-mini` 모델의 제약 조건을 `gpt-4o` 급으로 상향 검토 필요.
- 프롬프트 구조를 JSON 응답에 더 최적화된 형태로 재설계 필요 (Few-shot 예시 보강).
- 자막 데이터 전처리 시 타임스탬프를 더 명시적으로 태깅하여 전달할 것.
UX 공백 체감이 남아 있음.
- 이 구간은 API 쿼터 대응(백엔드 운영전략) + 클라이언트 fallback UX를 동시에 설계해야 안정적으로 해결 가능.
