# Merlin Family: 앱 공장 자동화 가이드 (v2.1)

작성일: 2026-04-19
설계자: Wizard Merlin & Gemini (AI Architect)

---

## 1. 실전 연동 및 SDK 진화 로드맵 (Evolutionary Strategy)

이미 개발된 앱들이 존재하므로, 선형적인 SDK 개발 대신 **'역추출 방식'**을 채택한다.

- **Phase 1: 허브(Hub Core) 구축** — 인프라(DB, Auth API, Wallet API)를 최우선으로 완성한다.
- **Phase 2: 기존 앱 수동 연동 (1~2호)** — 완성도가 높은 기존 앱들을 허브 API에 직접 연결하며 실전 데이터를 검증한다.
- **Phase 3: 패턴 추출 및 SDK 자산화** — 수동 연동 과정에서 반복되는 코드(상단바, 차감 로직 등)를 `packages/`로 모아 SDK화한다.
- **Phase 4: 전면 자동화 가동** — 정제된 SDK를 나머지 앱 및 향후 20개 신규 앱에 적용하여 생산 속도를 극대화한다.

---

## 2. 개발 공정: Hub-First & Interface-Based

- **허브 우선(Hub-First):** 개별 앱 개발 시 허브의 인터페이스(API 규격)를 먼저 정의하고 진행한다.
- **Mock 활용:** 연동 전까지는 가짜 허브 모드로 앱의 비즈니스 로직에만 집중한다.

---

## 3. 표준 SDK 인터페이스 (예정)

**Client:**
- `auth.exchangeCode`
- `wallet.getBalance`
- `apps.moveToApp`

**Server:**
- `wallet.useCredit(idempotencyKey)`
- `reward.grantReward`

---

## 4. UI Kit 및 인터렉션 표준

- **FamilySidebar:** 5분 주기 자동 노출 트리거 로직 내장.
- **FamilyTopBar:** 실시간 크레딧 잔액 표시 컴포넌트.
- **WarpOverlay:** "패밀리 워프 중..." 브랜딩 애니메이션.

---

## 5. AI 코딩 마스터 프롬프트 (Hub-Build 전용)

```
[Merlin Hub Core Build Prompt]

명령: Merlin Family OS의 심장인 [허브앱]의 기초 공사를 시작하라.

필수 조건:
- merlin_family_os_final_plan.md와 merlin_app_factory_guide.md를 프로젝트 루트에 저장하고 모든 로직의 기준으로 삼아라.
- DB 스키마: Supabase를 사용하여 사용자, 통합 지갑, 통합 원장 테이블을 설계하라.
- 핵심 API: 이메일 OTP 인증, 30초 유효 Transfer Code 발급 및 검증, 중복 차감 방지(Idempotency Key)가 적용된 지갑 API를 구축하라.
- 확장성: 현재 개발된 5개의 앱을 시작으로 총 20개 이상의 앱이 동시에 접속할 것을 가정하여 설계하라.
```

---

## 6. QC (품질 체크)

- [ ] 허브의 지갑 원장이 개별 앱의 활동을 정확히 기록하는가?
- [ ] 수동 연동 시 발생하는 반복 코드가 '공통 모듈화' 가능한 수준인가?
- [ ] 1회용 보안 코드가 30초 후 정확히 만료되는가?
