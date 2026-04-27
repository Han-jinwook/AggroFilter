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
4. 서버리스 환경에서 quota burst를 줄이기 위한 큐 도입 시 최소 변경안은?

---

## 7) 첨부 대상 자료

- 2026-04-27 21:14~21:17(KST) 서버 로그 원문
- 사용자 화면 스크린샷(상단 카드만 표시, 하단 공백)
- 관련 수정 파일 목록
  - `app/api/analysis/request/route.ts`
  - `app/page.tsx`
  - `app/p-result/ResultClient.tsx`
  - `lib/gemini.ts`

---

## 8) 현재 결론

- 즉시 실패(alert) 문제는 완화됨.
- 그러나 speed 429가 계속 발생할 때 UX 공백 체감이 남아 있음.
- 이 구간은 API 쿼터 대응(백엔드 운영전략) + 클라이언트 fallback UX를 동시에 설계해야 안정적으로 해결 가능.
