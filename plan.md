🚀 Project: 어그로필터 (AggroFilter) - Phase 1 Plan
Last Updated: 2026-04-26 KST


## 1. 서비스 개요 (Overview)
### 1.1 목표 (Goal)
유튜브 영상의 과장/낚시 여부를 분석하여 신뢰도 랭킹을 제공하고, 사용자에게 **건전한 채널을 추천(Navigation)**한다.

## 2. 유튜브 모듈 핵심 로직 (Functional Logic)
### 2.1 데이터 수집 전략 (Data Acquisition)
서버 IP 차단을 피하고 분석 품질을 확보하기 위해 클라이언트 사이드 추출을 원칙으로 함.

#### [PC] Chrome 확장프로그램
- **특징**: 최상위 분석 품질. 유튜브 UI와 완전 동기화.
- **역할**: 자막(CC), 메타데이터(조회수, 카테고리 등) 직접 추출 후 서버 전송.

#### [Mobile] 전용 WebView 앱 (Hybrid App)
- **방식**: 앱 내 WebView로 유튜브 로드 -> JS Injection -> DOM/API Intercept.
- **동의 기반 온보딩**: 사용자의 "콘텐츠 로드 및 자막 분석 동의"를 필수 전제로 함.
- **기술적 한계 인정**: 유튜브의 모바일 웹 대응에 따라 품질이 100% 보장되지 않을 수 있음을 UX로 명시 (예: "정밀 분석 가능 여부 확인 중...").

#### [Future] 온디바이스(On-device) 분석 검토
- **개념**: 서버 부하 및 프라이버시 고려, 자막 요약 등 가벼운 로직을 클라이언트(브라우저/앱) 내 AI 모델로 처리 시도.

## 3. 기술 스택 및 데이터 수집 (Tech Spec)
### 3.1 AI Engine
- **Main Model**: `gemini-2.5-flash` (영상 신뢰도/어그로 분석 메인)
- **Light Model**: `gemini-2.5-flash-lite` (단발 번역 등 가벼운 작업)
- **Why**: 속도와 가성비 최적화 + Google Search grounding 지원.
- **SDK**: Google Generative AI SDK (Paid Tier Key 필수).
- **위치**: `lib/gemini.ts` — `generateContentWithRetry`로 재시도 로직 포함.

## 4. 인증 및 글로벌 (Common)
- **인증 (Authentication)**: Google OAuth 기반. 확장프로그램 연동성을 위해 구글 로그인 기본 적용 (이메일 인증 생략).
- **글로벌 (i18n)**: `navigator.language` 기반 자동 감지. UI 텍스트 및 카테고리 명칭 대응.

## 5. 핵심 미션 (Current Missions)
1.  **AI 분석 로직 고도화**: `lib/gemini.ts`에 이미 반영된 최신 프롬프트 기준 분석 로직 유지 및 고도화.
2.  **DB 스키마 정교화**: `t_channels`에 `f_language`, `f_country` 추가 완료. 이를 활용한 랭킹 쿼리 작성.
3.  **Client-Server 데이터 연동**: 확장프로그램/WebView로부터 전달받은 `transcript`와 `meta_data`를 처리하는 API 엔드포인트 구현 (확장프로그램에서 유튜브 API를 통해 메타데이터 선취득 구조 고려).
4.  **랭킹 시스템 구현**: 카테고리별/국가별 실시간 랭킹 산출 로직 구현.

## 6. 실행 로드맵 (Roadmap)

### Step 1: 구조 잡기 ✅ 완료
- App Shell (헤더, 라우팅) 구현.
- DB 스키마 (t_videos, t_channels)에 언어/국가 필드 적용.

### Step 2: 분석 엔진 완성 ✅ 완료
- Gemini 2.5 Flash 연동 및 프롬프트 최적화.
- 클라이언트(확장팩/앱)에서 자막 받아오는 API 연동.

### Step 3: 랭킹 시스템 ✅ 완료
- 랭킹 산정 쿼리 및 캐싱 시스템 구현.
- 랭킹 UI (무한 스크롤, 내 순위 스티키 바, Top 3 명예의 전당) 구현.

### Step 4: 알림 시스템 ✅ 완료 (트리거 연결 제외)
- 알림 발송 API (등급변화, 랭킹변동, 상위10%) 구현.
- 알림 페이지 UI (목록, 읽음처리, 타입별 아이콘, 모두읽음) 구현.
- 배치 알림 발송 API (하루 2회 cron, 미발송 알림 일괄 이메일) 구현.

### Step 5: 결제 시스템 (카페24) 🔧 코드 완성, 세팅 필요
- OAuth 인증 플로우, Webhook 수신, 크레딧 충전 로직 구현 완료.
- 카페24 쇼핑몰 세팅 (앱 설치, 상품 등록, Webhook URL 등록) 필요.
- Mock 결제 → 실결제 전환 필요.

### Step 6: 관리자 (Admin) ✅ 완료
- 통계, 분석 로그 (삭제 기능 포함), 크레딧 관리, 결제 로그 탭 구현.

### Step 7: 분석 UX 비동기 전환 (Zero 체감 대기) 🔜 계획 확정
- 기존 `app/api/analysis/request/route.ts` + `lib/gemini.ts`를 파일 A(정밀 분석) 기준으로 유지.
- 파일 B(`lib/gemini-speed.ts` 또는 `lib/gemini-spoiler.ts`)를 신규 분리하여 요약/타임라인/스포일러를 빠르게 생성.
- 프롬프트는 문장 수정 금지, 블록 단위 삭제(가위질)만 허용.
- 크레딧 차감 로직은 현행 1회 차감 정책을 그대로 유지(수정 금지).
- UI는 퀴즈/강제 로딩 제거, 결과 페이지 즉시 진입 + 스켈레톤 기반 단계적 렌더링으로 전환.
- A/B 결과는 모두 저장하되, B 1차 업데이트 후 A 2차 완성 업데이트 방식 적용.
- A 실패(90초 타임아웃 포함) 시 B 결과는 유지하고 A 영역만 재시도 UX 제공.

## 7. 알림 시스템 (Notification System)
### 7.1 채널 구독 및 알림 메커니즘
- **자동 구독**: 사용자가 영상을 분석하면 해당 채널을 자동으로 구독 처리
- **알림 조건**: 구독 채널의 상태 변화 시 이메일 알림 발송
- **알림 설정**: 사용자가 마이페이지에서 알림 활성화/비활성화 가능

### 7.2 알림 발송 조건
#### 1. 신뢰도 그레이드 변화 알림 (우선순위: 높음)
- **조건**: 구독 채널의 신뢰도 그레이드가 변경될 때 (Red ↔ Yellow ↔ Green)
- **그레이드 기준**:
  - 🟢 Green Zone: 신뢰도 70점 이상
  - 🟡 Yellow Zone: 신뢰도 40~69점
  - 🔴 Red Zone: 신뢰도 39점 이하
- **알림 내용**: 카테고리, 채널명, 기존 등급 표시 (변화값은 표시하지 않음)
- **목적**: 신뢰하던 채널의 품질 변화를 즉시 감지

#### 2. 순위 변동 알림 (우선순위: 중간)
- **조건**: 구독 채널의 카테고리 내 순위가 유저 설정 threshold 이상 변동될 때
- **threshold 옵션**: 10% / 20% / 30% (유저가 설정 페이지에서 선택, DB `t_users.f_ranking_threshold` 저장)
- **DB 컬럼**: `t_users.f_ranking_threshold INTEGER DEFAULT 10`

#### 3. 상위 10% 진입/탈락 알림 (우선순위: 낮음)
- **조건**: 구독 채널이 카테고리 상위 10%에 진입하거나 탈락할 때
- **쿨다운**: 동일 채널 7일 내 재알림 없음 (잦은 왔다갔다 스팸 방지)
- **DB 컬럼**: `t_channel_subscriptions.f_top10_notified_at TIMESTAMPTZ`
- **계산 방식**: 카테고리 전체 채널 수 × 0.1 (올림)

### 7.3 구독 관리 기능
- **위치**: 마이페이지 > 나의 채널 탭
- **UI**: '구독 관리' 버튼 클릭 시 관리 모드 활성화
- **기능**:
  - 좌측 체크박스로 채널 선택
  - 전체 선택/해제 (헤더 체크박스)
  - 선택 삭제 버튼 (하단)
- **API**: `/api/subscription/unsubscribe` - 선택한 채널 구독 해제

### 7.4 구현 완료 항목
- `t_channel_subscriptions` 테이블: 구독 정보 및 이전 상태 추적 (상위 10% 상태 포함)
- `lib/notification.ts`: 자동 구독 및 변화 감지 로직 (상위 10% 계산)
- `/api/notification/send-grade-change`: 그레이드 변화 알림 API
- `/api/notification/send-ranking-change`: 랭킹 변동 알림 API
- `/api/notification/send-top10-change`: 상위 10% 변화 알림 API
- `/api/notification/list`: 알림 목록 조회 + 읽음 처리 API
- `/api/notification/unread-count`: 미읽음 개수 API
- `/api/subscription/unsubscribe`: 구독 해제 API
- `/api/notification/batch-send`: 배치 알림 발송 API (하루 2회 cron 연동 대상)
- 마이페이지 구독 관리 UI (체크박스 선택 삭제)
- 알림 페이지 UI (목록, 읽음처리, 타입별 아이콘/색상, 모두읽음 버튼)
- 알림 클릭 시 채널 통합 리포트(`/channel/[id]`)로 이동

### 7.5 향후 추가 예정
- **구독 채널 리포트**: 마이페이지 내 상시 확인 가능한 대시보드 기능
- **알림 세부 설정**: 마이페이지 > 알림 설정에서 일괄 관리
- **배치 알림 Cron 연결**: Netlify scheduled function으로 12:00/19:00 자동 발송

## 8. 카페24 결제 시스템 (Payment via Cafe24)

### 8.1 구현 완료 (코드)
- **OAuth 인증**: `api/cafe24/oauth/start` → `callback` → 토큰 저장/갱신 (`lib/cafe24.ts`)
- **Webhook 수신**: `api/cafe24/webhook` — 주문완료 이벤트 수신, 중복 방지, 결제 상태 검증
- **크레딧 충전**: 주문 데이터에서 이메일 추출 → 상품→크레딧 매핑 → `t_users.f_recheck_credits` 업데이트
- **미매칭 결제**: 유저 못 찾으면 `t_unclaimed_payments`에 로깅
- **Mock 결제**: `payment/mock/page.tsx` — 테스트용 결제 페이지

### 8.2 남은 세팅 작업
1. **환경변수 등록** (Netlify): `CAFE24_MALL_ID`, `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `CAFE24_REDIRECT_URI`, `CAFE24_OAUTH_SCOPE`, `CAFE24_WEBHOOK_SECRET`, `CAFE24_CREDIT_PRODUCT_MAP`
2. **카페24 앱 설치**: 쇼핑몰에서 앱 설치 후 `/api/cafe24/oauth/start` 1회 호출하여 토큰 발급
3. **Webhook URL 등록**: 카페24 개발자센터 → 주문완료 이벤트 → `https://도메인/api/cafe24/webhook?secret=xxx`
4. **크레딧 상품 등록**: 카페24 쇼핑몰에 1/5/10 크레딧 상품 등록 → `CAFE24_CREDIT_PRODUCT_MAP` JSON 매핑
5. **Mock → 실결제 전환**: 채널리포트 "충전" 버튼 → 카페24 쇼핑몰 결제 URL로 변경

## 9. 마케팅 자동화 (Marketing Automation) — Phase 2

> **전제**: 11장 TODO 항목 전부 완료 후 착수.

### 9.1 구축 예정 항목
- **SEO 자동화**: 사이트맵 생성, 구조화 데이터(JSON-LD), OG 메타태그 동적 생성
- **소셜 공유 최적화**: 분석 결과 카드 이미지 자동 생성 (OG Image), 공유 URL 단축
- **이메일 마케팅**: 신규 가입 웰컴 메일, 비활성 유저 리텐션 메일, 주간 다이제스트
- **리퍼럴 시스템**: 초대 링크 생성, 초대 보상 크레딧 지급
- **랜딩 페이지**: 서비스 소개 + CTA (분석 체험) 페이지
- **UTM 트래킹**: 유입 경로별 전환율 추적 (GA4 연동)
- **푸시 알림**: 웹 푸시 (Service Worker) 또는 앱 푸시
- **콘텐츠 마케팅**: 블로그/뉴스레터 자동 발행 (인기 채널 분석 리포트 등)

### 9.2 우선순위 (예정)
1. 랜딩 페이지 + SEO 기본 세팅
2. 이메일 마케팅 (웰컴 + 주간 다이제스트)
3. 소셜 공유 카드 이미지 자동 생성
4. 리퍼럴 시스템
5. 푸시 알림

- [ ] **출시 직전: 원데이 핫이슈 기준 최종 확정**: 현재 f_created_at (분석일) 24시간 단독 기준 유지
  - 현재 상태: f_created_at (분석일) 기준, 24시간 이내 분석된 영상만 표시
  - 출시 시: 이 기준 그대로 유지 (f_last_action_at 기능은 보류)
  - 영향 범위: `/api/plaza/hot-issues`
  - 우선순위: 출시 직전 최종 확인

## 11. 최근 주요 업데이트 (Recent Updates)

### 11.0 2026-04-26 업데이트 (분석 UX 비동기 분할 설계 확정 🧭)
#### 의사결정 확정
- 파일 A 기준: `app/api/analysis/request/route.ts` + `lib/gemini.ts` 유지.
- 파일 B 기준: `lib/gemini-speed.ts`(또는 `lib/gemini-spoiler.ts`) 신규 생성.
- 프롬프트 정책: 토씨 수정 금지, 블록 삭제만 허용.
- API 전략: 서버리스 타임아웃 대응을 위해 기존 `status` 폴링 구조 재활용.
- 과금 정책: 기존 크레딧 차감 로직 변경 금지(현행 유지).
- 저장 정책: B 선저장(1차) + A 후완성(2차)로 DB 반영.
- UX 정책: 퀴즈/강제 로딩 화면 제거, 결과 페이지 즉시 진입.
- 실패 정책: B 성공 + A 지연/실패 시 A 영역만 "정밀 분석 지연(재시도)" 처리.
- 백업 정책: 구현 전 `backup/async-migration` 백업 브랜치 스냅샷 생성.

### 11.0 2026-02-24 업데이트 (UX·성능·알림 고도화 ✅)
#### UX 개선
- **댓글 Optimistic Update**: 엔터 시 즉시 UI 반영, API 응답은 백그라운드 처리 (실패 시 롤백)
- **헤더 sticky 고정**: `relative` → `sticky top-0 z-50` 복구
- **익명 알림종 클릭**: `GlobalLoginModal` 컴포넌트를 `layout.tsx`에 추가 → 모든 페이지에서 이벤트 수신
- **익명 프로필 이메일 영역**: 클릭 시 로그인 모달 오픈 (보기/수정 모드 모두)
- **채널 랭킹 검색창**: 내부 언어 표시 제거 (우측 버튼으로 충분)

#### 버그 수정
- **신호등 이미지 기준**: `>= 50` → `>= 40` (plan.md 기준 70/40/39 일치)
- **신뢰도 등급**: `Blue` → `Green` 전면 수정 (`lib/notification.ts`, 설정 UI, plan.md)

#### 성능 개선
- **hot-issues API 캐시**: 서버 인메모리 캐시 추가 (sort/direction/lang별 1시간 TTL)
- **플라자 클라이언트 캐시**: 모듈 레벨 `Map` 캐시 — 탭 전환 시 재fetch 없음 (10분 TTL)
  - 원인: Netlify 서버리스는 요청마다 새 인스턴스 → 서버 인메모리 캐시 무효
  - 해결: 클라이언트 모듈 레벨 캐시로 브라우저 세션 내 보존

#### 알림 시스템 고도화
- **순위 변동 threshold**: `t_users.f_ranking_threshold` (10/20/30%) DB 저장, 유저별 개인화 알림
- **Top 10% 7일 쿨다운**: `t_channel_subscriptions.f_top10_notified_at` 활용
- **알림 설정 merge 이전**: 익명→로그인 시 알림 설정 값 email 유저에게 복사
- **알림 발송 시간**: 자정 12시 · 오후 7시 명시

---

### 11.0 2026-02-23 업데이트 (UUID 정공법 전면 리팩토링 🔑✅)

#### 배경
- 이메일/UUID 혼용 하이브리드 로직으로 인한 기술 부채 및 데이터 불일치 위험 제거
- 익명 사용자(anon_xxx) 지원을 위한 UUID 단일 식별 체계 확립

#### 수정된 백엔드 API (이메일 → UUID 전용)
- `app/api/analysis/request/route.ts`: `user.email` → `user.id` 변경, 이메일 기반 닉네임 추론 제거
- `app/api/analysis/result/[id]/route.ts`: 인터랙션/퀴즈 조회 UUID 전용
- `app/api/user/merge/route.ts`: **핵심 버그 수정** — anon 유저 조회를 `f_email` → `f_id`로 수정, `userId` 파라미터 추가
- `app/api/admin/unclaimed-payments/route.ts`: UUID 기반 수동 지급
- `app/api/admin/credits/route.ts`: UUID 기반 크레딧 조회/수정
- `app/api/comments/route.ts`, `like/route.ts`, `delete/route.ts`: UUID 전용
- `app/api/interaction/route.ts`: UUID 전용
- `app/api/notification/*/route.ts` (4개): UUID 전용
- `app/api/mypage/videos/route.ts`: UUID 전용
- `app/api/payment/callback/route.ts`: UUID 전용
- `app/api/auth/verify-code/route.ts`: `uuidv4` import 추가

#### 수정된 라이브러리
- `lib/merge.ts`: 함수 시그니처 `(email)` → `(userId, email?)` 변경
- `lib/notification.ts`: UUID 기반 알림 발송
- `lib/cafe24.ts`: UUID 기반 크레딧 충전

#### 수정된 프론트엔드
- `components/c-login-modal/index.tsx`: `verifyOtp` 후 `user.id` 추출 → `onLoginSuccess(email, userId)` 콜백 전달
- `components/c-app-header/index.tsx`: `syncSession`에서 `userId` localStorage 저장
- `app/page.tsx`, `p-result/ResultClient.tsx`, `p-settings/page.tsx`, `p-notification/page.tsx`, `p-my-page/MyPageClient.tsx`: `handleLoginSuccess(email, userId)` 시그니처 통일

#### 관리자 API 이메일 사용 (정상 — 제거 불필요)
- `getAdminEmail()` 함수: 관리자 **권한 체크**용 (사용자 데이터 식별 아님)
- 관리자 로그 표시용 `u.f_email` JOIN: 읽기 전용 표시

---

### 11.0 2026-02-22 업데이트 (Plaza 최적화 + 촉퀴즈/촉점수 시스템 보강 🎯✅)

#### Plaza API 인메모리 캐싱 (서버 부하 최소화)
- **1시간 TTL 인메모리 캐시** 적용: `lib/plaza-cache.ts` 유틸리티 생성
- 적용 대상: `/api/plaza/hot-channels`, `/api/plaza/videos`, `/api/plaza/channels`
- 캐시 키에 언어 포함 → 언어별 독립 캐시 (`channels:korean`, `channels:english`)

#### Plaza 언어 필터링
- **전체 분석 채널** 섹션에 언어 필터 추가 (`/api/plaza/channels?lang=korean`)
- `COALESCE(c.f_language, 'korean') = $1` 쿼리 적용
- `page.tsx`에서 `currentLanguage` 파라미터 전달 및 `useEffect` 의존성 추가

#### DB 스키마: t_analyses에 f_language 컬럼 추가
- **문제**: 분석 저장 시 `f_language` 컬럼 부재로 채널 통계 갱신 쿼리 실패
- **해결**: `ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_language VARCHAR`
- 기존 데이터 backfill: `t_channels.f_language` → `t_analyses.f_language`
- 분석 저장 INSERT에 `f_language` 값 추가 (`finalLanguage` 파라미터)
- 채널 통계 갱신 쿼리 복원: `COALESCE(a.f_language, 'korean')` 정상 사용

#### 채널 랭킹: 언어 변경 시 카테고리 자동 fallback
- **문제**: 한국어/게임 → 영어 전환 시 영어/게임에 데이터 없으면 빈 화면
- **해결**: API 응답 0개 + 카테고리 지정 시 → 자동으로 `category=` (전체)로 `router.replace`

#### 촉퀴즈 최소 표시 시간 (8초)
- **문제**: DB 캐시 히트 시 API 즉시 반환 → 촉퀴즈가 0.2초만에 사라짐
- **해결**: `startAnalysis()`에 `quizMinEndTime = Date.now() + 8000` 추가
- API 응답 후 남은 시간만큼 대기 → 퀴즈 풀 시간 보장

#### 촉점수 유저별 완전 분리 (익명 포함)
- **문제 1**: `c-prediction-comparison.tsx`에서 익명유저가 `'anonymous'`로 통합 저장
  - **해결**: `getUserId()` 사용으로 고유 `anon_uuid` 저장
- **문제 2**: 익명유저 누적 촉점수 통계가 `t_users`에 저장 안 됨
  - **해결**: `prediction/submit` API에서 `UPDATE` → `INSERT ... ON CONFLICT DO UPDATE` UPSERT 변경

#### 기타
- **Hydration 에러 수정**: `layout.tsx` `<body>` 태그에 `suppressHydrationWarning` 추가
- **헤더 로고 확대**: 내부 패딩 제거(`py-0`), 로고 `h-[4.75rem]`, 유튜브 글자 `text-base`

### 11.1 2026-02-21 업데이트 (데이터베이스 구조 개선 v3.3 🗄️✅)
- **t_channel_stats 스키마 변경**: 언어별 통계 완전 분리
  - PK 변경: `(channel_id, category_id)` → `(channel_id, category_id, language)`
  - 채널+카테고리+언어 3차원 통계 관리로 언어별 랭킹 완전 독립
- **데이터 흐름 최적화**:
  - `t_channels`: 채널 메타정보 (f_language = 채널 대표 언어)
  - `t_analyses`: 영상별 분석 결과 (f_language 컬럼 추가 완료)
  - `t_channel_stats`: 채널+카테고리+언어 조합별 통계 집계
- **t_videos 테이블 의존성 제거**: 
  - 분석 API에서 t_videos INSERT 로직 제거
  - 랭킹 계산을 t_analyses 기반으로 전환 (재분석 중복 제거 로직 포함)
  - lib/ranking_v2.ts v3.3: t_channels JOIN 제거, 성능 최적화
- **불필요한 파일 정리**: collector.js, collect-and-analyze-videos 삭제
- **실전 검증 완료**: 
  - 53개 채널 마이그레이션 (Korean 51개, English 2개)
  - 언어별 랭킹 캐시 재생성 성공
  - NBC News(영어)와 MBCNEWS(한국어)가 각각 독립된 랭킹에 정상 진입

### 11.2 2026-02-20 업데이트 (글로벌 랭킹 시스템 v3.1 완성 + 실전 테스트 완료 🌍✅)
- **언어 단일 체계 전환**: 국가 코드 제거, 언어 기반 랭킹으로 단순화 (`korean`, `english` 등)
- **DB 언어 코드 표준화**: `ko` → `korean`, `en` → `english` (영어 표준 사용)
- **3단계 언어 감지 로직**: YouTube API → Transcript 분석 → 기본값 (모든 신규 분석에 적용)
- **t_channel_stats 기반 랭킹**: 한 채널이 여러 카테고리에 포함 가능 (34개 → 52개 엔트리)
- **언어별 카테고리 필터링**: `/api/topics?lang=korean` - 언어별 활성 카테고리 목록 제공
- **언어 드롭다운 UI**: 헤더에 언어 선택 버튼, 언어 변경 시 카테고리 자동 업데이트
- **URL 기반 언어 전환**: `/p-ranking?category=&lang=english` - 상태 동기화 완벽 구현
- **채널 중복 제거**: 언어별 전체 조회 시 채널별 최고 점수 기준으로 정렬
- **Backfill 완료**: 기존 NULL 언어 값 → `korean` 업데이트, 영어 채널 1개 확인
- **실전 테스트 완료 (2026-02-20 22:30)**: NBC News(영어) 분석 → 언어별 랭킹 정상 분리 확인
  - 분석 결과 페이지: 언어 뱃지 표시 (`English`), 영어/뉴스 카테고리 내 1위/1개 정확히 표시
  - 랭킹 페이지: 언어 파라미터 전달 정상, 한국어/영어 채널 완전 분리
  - 언어 드롭다운: 채널 수 정확 표시 (Korean 51개, English 2개)
  - 언어/카테고리 전환 시 URL 파라미터 유지 및 상태 동기화 완벽 작동
- **디버깅 도구 추가**: `scripts/debug_language_ranking.cjs`, `scripts/refresh_ranking_cache.cjs`

### 11.2 2026-02-20 업데이트 (채널 랭킹 페이지 모바일 UI 최적화 📱)
- **공간 최적화**: 모바일에서 뒤로가기 버튼, ? 버튼 숨김 처리 (PC에서는 유지)
- **헤더 레이아웃 개선**: 
  - 채널 랭킹 배지 크기 축소 (`text-sm`, `px-2`)
  - 카테고리명과 언어 표시 분리 배치 (가독성 향상)
  - 1위 왕관 크기 및 위치 조정 (모바일: `text-lg`, `-top-3` / PC: `text-3xl`, `-top-7`)
- **반응형 텍스트 크기**: 모바일 `text-sm`, PC `text-base/lg` 적용
- **결과**: 모바일에서 헤더가 콘텐츠를 가리지 않고, 모든 정보가 명확히 표시됨

### 11.2 2026-02-20 업데이트 (AI 분석 고도화)
- **Google Search grounding 정상 작동**: 최신 정보 기반 팩트체크 (예: "2026년 2월 현재 틱톡 1000만뷰" 검증)
- **JSON 파싱 실패 해결**: 3단계 복구 로직 (제어문자 수리 → regex 필드 추출 → 에러)
- **504 타임아웃 대응**: 클라이언트 `/api/analysis/status` 폴링으로 중복 분석 방지
- **자막 없는 영상 분석 가능**: 제목+썸네일 기반 점수 정상 표시 (기존: 0점)
- **프롬프트 유연화**: '경험 제공' 하드코딩 제거, Gemini 자율 판단 (팩트 vs 주제적 일관성)

### 11.4 2026-02-23 업데이트 (세션 3)
- **카페24 Client ID 확인**: `IlIvZtcsP9di8m1yxe9vxF` — 개발자센터 App 관리에서 기존 앱 확인
- **카페24 OAuth 토큰 발급 완료**: `/api/cafe24/oauth/start` 호출 → 콜백 정상 처리, DB 저장 확인
- **카페24 앱 심사 요청 완료** (2026-02-23): 심사중 상태 — 승인 후 주문완료 웹훅 등록 가능
- **카페24 웹훅 일회성 등록 API 추가**: `/api/cafe24/webhook/register` (CAFE24_WEBHOOK_SECRET으로 보호)
- **새 브라우저 로그인 시 프로필 이미지 미표시 버그 수정**: `syncSession`에서 `userProfileImage` 없을 때 DB fetch 추가
- **알림 페이지 API 파라미터 버그 수정**: `email` → `userId` 파라미터로 수정 (`p-notification/page.tsx`)
- **Mock → 실결제 전환**: 충전 모달에서 1/5/10 크레딧 선택 → 카페24 상품 페이지(`product_no` 18/19/20)로 직접 이동
- **알림 트리거 폐기**: 분석 완료 후 `checkRankingChangesAndNotify` 호출 제거 — 40초 대기 후 즉시 결과 확인하는 UX와 충돌, 랭킹 변동 알림은 모닝 리포트 cron으로만 운영
- **도메인 구매 및 연결** (2026-02-23): `aggrofilter.com` 카페24에서 구매 → Netlify 커스텀 도메인 추가, A레코드(`75.2.60.5`), CNAME(`www` → `aggrofilter.netlify.app`) 설정 완료 → DNS 전파 대기 중
- **환경변수 도메인 업데이트**: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_URL`, `CAFE24_REDIRECT_URI` → `https://aggrofilter.com` 으로 변경
- **카페24 App URL / Redirect URI 변경**: `https://aggrofilter.netlify.app` → `https://aggrofilter.com`

### 11.3 2026-02-23 업데이트 (세션 2)
- **로그인 방식 전환**: `LoginModal`의 `supabase.auth.signInWithOtp` → 자체 `/api/auth/send-code` + `/api/auth/verify-code` API로 전환 (Supabase OTP 발송 실패 문제 해결)
- **p-settings UUID 전환**: `/api/user/profile`, `/api/subscription/notifications`, `/api/prediction/stats` 호출 시 `?email=` → `?id=` (UUID) 파라미터로 전환. 알림 토글 PUT, 프로필 저장 PUT도 동일하게 수정
- **credits/route.ts 빌드 에러 수정**: `searchParams` 선언 누락 및 `const id` → `let id` 재할당 오류 수정
- **전수 검사**: `const` 재할당 패턴 전체 API 파일 검사 완료 (credits 외 정상)

### 11.2 2026-02-14 업데이트
- **알림 페이지 구현**: placeholder → 실제 알림 목록 표시 (타입별 아이콘/색상, 읽음처리, 모두읽음)
- **알림 클릭 → 채널 통합 리포트**: 알림 링크를 `/p-ranking` → `/channel/[id]`로 변경
- **마이페이지 탭 상태 유지**: URL 파라미터 기반 탭 상태 관리, 뒤로가기 시 데이터 재로드
- **Admin 분석 로그 관리**: 삭제 기능, 비로그인 사용자 표시, 채널명 컬럼 추가

### 11.2 2026-02-03 업데이트
- **Top 3 명예의 전당 UI**: 카테고리별 랭킹 상단 1/2/3위 시각 강조
- **'내 순위로 이동' 호환성 확보**: Top 3 내 순위도 정상 스크롤
- **채널 재분석 모달 UX 개선**
- **Mock 결제 페이지 문구 수정**

---

## 12. 남은 할 일 (TODO)

### HIGH — 수익화 & 핵심 기능
| # | 항목 | 상태 |
|---|------|------|
| 1 | 카페24 환경변수 세팅 (Netlify) | ✅ 완료 (7개 변수, CREDIT_PRODUCT_MAP 포함) |
| 2 | 카페24 앱 설치 → OAuth 토큰 발급 | ✅ 완료 (2026-02-23) |
| 3 | 카페24 Webhook URL 등록 | ⏳ 심사 승인 대기 중 (2026-02-23 심사 요청) |
| 4 | 크레딧 상품 등록 + CREDIT_PRODUCT_MAP 매핑 | ✅ 완료 (상품 18/19/20 → 1/5/10 크레딧) |
| 5 | Mock → 실결제 전환 (충전 버튼 URL 변경) | ✅ 완료 (2026-02-23) |
| 6 | 알림 트리거 연결 (분석 완료 → checkRankingChangesAndNotify 호출) | ❌ 폐기 (2026-02-23) — 분석 즉시 결과 확인 UX와 충돌, 불필요 |
| 7 | aggrofilter.com 도메인 구매 + DNS + HTTPS | ✅ 완료 (2026-02-23) |
| 8 | 매직링크 로그인 구현 | ✅ 완료 (2026-02-24) |

### MEDIUM — 품질 & 운영
| # | 항목 | 상태 |
|---|------|------|
| 23 | 백업 브랜치 `backup/async-migration` 생성 및 스냅샷 고정 | 예정 |
| 24 | 분석 진입 라우팅 개편 (퀴즈/로딩 제거, 결과 페이지 즉시 진입) | 예정 |
| 25 | 파일 B 분리 (`lib/gemini-speed.ts`) 및 프롬프트 블록 가위질 분리 | 예정 |
| 26 | A/B 병렬 호출 + `status` 폴링 재활용으로 2단계 렌더링 구현 | 예정 |
| 27 | B 1차 저장 + A 2차 완성 저장(덮어쓰기 충돌 방지) 구현 | 예정 |
| 28 | A 90초 타임아웃 시 하단 재시도 UX 적용 | 예정 |
| 7 | 결제 완료 후 앱 복귀 흐름 확인 (webhook 비동기 특성) | 대기 |
| 8 | Admin: 미매칭 결제(t_unclaimed_payments) 관리 UI | 대기 |
| 9 | t_payment_logs에 실제 결제 기록 저장 | 대기 |
| 10 | 알림 설정 토글 → 서버(f_notification_enabled) 동기화 | ✅ 완료 |
| 11 | 배치 알림 Cron 설정 (Netlify scheduled function, 12:00/19:00) | ✅ 완료 (동작 확인됨) |
| 12 | Resend 커스텀 도메인 설정 (스팸 방지) | ✅ 완료 (DNS 전파 + RESEND_FROM_EMAIL 환경변수 추가) |
| 13 | f_user_id email vs UUID 전수 검사 → 일관성 확보 | ✅ 완료 (2026-02-23) |
| 14 | 비로그인 분석 데이터 정리 정책 수립 | ✅ 완료 (3년 보관 정책 확정, 데이터 많아질 때 cron으로 처리) |
| 15 | Admin 통계: 고유 분석 사용자 수 + 차트 개선 (SVG 바차트, 도넛, 신규/재분석, 언어별) | ✅ 완료 |
| 22 | 광고 세팅 (SideWingAds 실제 콘텐츠 연결) | 대기 |
| 16 | 모바일 반응형 최종 점검 | 대기 |

### LOW — 개선 & 스케일
| # | 항목 | 상태 |
|---|------|------|
| 17 | 이메일 내 CTA 링크 /channel/[id]로 변경 | ✅ 완료 (f_link 저장 시 이미 /channel/[id] 사용, Blue→Green 등급 수정) |
| 18 | SEO / OG 메타태그 점검 | 대기 |
| 19 | 에러 핸들링 강화 (토스트 등) | ✅ 완료 (전역 ToastContainer 추가, 어드민 alert() → toast 교체) |
| 20 | 플라자 정렬/필터 개선 | ✅ 완료 |
| 21 | f_rank 컬럼 마이그레이션 (스케일 대비) | ✅ 완료 |

---

## 13. 2026-03-04 업데이트

### 버그 수정 완료
- **카페24 OAuth mall_id 동적 처리**: 콜백 URL 파라미터에서 동적으로 읽도록 수정 → 재심사 요청 중
- **오토마케터 스케줄**: 06:00/18:00 → 00:00/12:00 KST (자정/정오)
- **오토마케터 수집 확대**: 시간 창 12h→24h, Type2 VPH 기준 완화(PlanA 250, PlanB 500), 버퍼 max(m*3,5)
- **오토마케터 자막 전처리**: 8000자 4등분 샘플링 추가 → 184K자 긴 자막 504/폴링 타임아웃 방지
- **Supabase RLS 활성화**: bot_comment_logs, bot_community_targets, t_payment_logs, t_magic_links

### 남은 TODO (2026-03-04 기준)

#### HIGH
| 항목 | 상태 |
|------|------|
| 카페24 Webhook URL 등록 | ⏳ 재심사 중 (mall_id 버그 수정 후 재요청) |
| 크롬 확장프로그램 Chrome Web Store 등록 | ⏳ 진행 예정 |
| 오토마케터 모듈2 백엔드 — naverLoginId/Pw 저장 지원 | 대기 |

#### MEDIUM
| 항목 | 상태 |
|------|------|
| 결제 완료 후 앱 복귀 흐름 확인 (webhook 비동기) | 대기 |
| 광고 세팅 (SideWingAds 실제 콘텐츠 연결) | 대기 |
| 모바일 반응형 최종 점검 | 대기 |
| 오토마케터 모듈2 중복 댓글 방지 | 대기 |
| 오토마케터 모듈3 탭 신설 (크롤링/댓글 자동화 현황) | 대기 |
| 오토마케터 모듈3 네이버 카페 스캐너 구현 | 대기 |

#### LOW
| 항목 | 상태 |
|------|------|
| SEO / OG 메타태그 점검 | 대기 |
| Admin: 미매칭 결제 관리 UI | 대기 |

---

## 14. 2026-03-05 업데이트

### SEO 기본세트 적용
- `robots.txt`, `sitemap.xml` GET 라우트 핸들러 추가 (405 해결)
- OG 이미지 라우트 (`/api/og`) 1200x630 추가 + 메타데이터 연결
- 홈 온보딩 전환 + 확장프로그램 가이드 페이지 추가
- 카테고리 화이트리스트 입구컷 + 422 즉시 에러 UX

---

## 15. 2026-03-08 18:00 KST — MyPage 구독 아키텍처 개편 + 익명 분석 지원

### 핵심 개념 정립
- **구독 = 관심 = 분석** — 단일 개념. 결과 페이지 진입 시 해당 채널+영상이 자동 구독됨.
- 각 유저는 **자신만의 구독일**을 가짐 (원본 분석일과 별개).
- 구독 삭제 → 해당 채널의 영상 구독도 전부 소멸. 원본 분석 데이터(`t_analyses`)는 불변.

### 신규 테이블
- **`t_video_subscriptions`** (`f_user_id`, `f_video_id`, `f_channel_id`, `f_subscribed_at`, UNIQUE(user,video))
  - 유저별 영상 구독 기록. 날짜는 유저의 결과페이지 진입 시각.

### 신규 API
| API | 설명 |
|-----|------|
| `POST /api/analysis/claim` | 분석 레코드의 f_user_id를 현재 유저로 claim (NULL/anonymous → userId) |
| `POST /api/subscription/track` | 결과 페이지 진입 시 채널+영상 구독 upsert (t_channel_subscriptions + t_video_subscriptions) |
| `POST /api/mypage/channels` | 유저의 구독 채널 목록 조회 |
| `POST /api/mypage/channel-videos` | 채널별 내 구독 영상 조회 (구독일 기준) |

### 수정 파일
| 파일 | 변경 요약 |
|------|----------|
| `api/analysis/request` | 익명 userId(anonId) 우선 사용, Supabase 세션으로 덮어쓰기 방지. f_user_id에 'anonymous' 대신 null 저장 |
| `api/mypage/videos` | t_video_subscriptions 기반 쿼리로 전환. 표시 날짜 = 내 구독일(f_subscribed_at) |
| `api/mypage/channel-videos` | userId 파라미터 추가. 내 구독 영상만 + 내 구독일로 반환 |
| `api/subscription/unsubscribe` | 채널 삭제 시 t_video_subscriptions 연쇄 삭제 추가 |
| `p-result/ResultClient` | analysis/claim 호출 추가 (결과 페이지 진입 시), subscription/track 디버깅 로그 |
| `p-my-page/MyPageClient` | 구독 채널 API 연동, 채널 펼침 시 영상 fetch + userId 전달, groupedVideos 키 수정 |

### 백필
- `scripts/backfill_video_subscriptions.cjs` 실행: 기존 114개 채널 구독 → 109개 영상 구독 레코드 생성

---

## 16. 2026-03-09 01:00 KST — 알림 조건 상향 + 홈 CTA + PWA 셋업

### 알림 채널 조건 상향
- `lib/notification.ts`: 구독자 쿼리에 `t_video_subscriptions COUNT >= 2` 서브쿼리 추가
- 해당 채널 영상 **2개 이상 열람한 유저만** 알림 대상 (N=2, 시스템 상수)
- 설정 UI 미변경 (유저 볼륨 늘어난 후 옵션화 예정)

### 홈 플라자 CTA 버튼
- `app/c-home/feature-cards.tsx`: feature cards 아래 "분석된 채널·영상 둘러보기" 버튼 추가
- `/p-plaza` 링크, indigo→purple 그라데이션
- 모바일 사용자가 기존 분석 결과를 탐색하도록 유도

### PWA 셋업
- `public/manifest.json`: name, short_name, icons(192/512), theme_color(#6366f1), standalone
- `public/sw.js`: 정적 자산 cache-first, 네비게이션 network-first + 오프라인 폴백
- `public/icon-192x192.png`, `public/icon-512x512.png`: 정사각형 패딩 처리 후 리사이즈
- `app/layout.tsx`: manifest 메타데이터 연결, theme-color/apple-mobile-web-app 메타, SW 자동 등록 스크립트

### 잔여 TODO
| 항목 | 상태 |
|------|------|
| 카페24 Webhook URL 등록 | 재심사 승인 대기 |
| 크롬 확장프로그램 Web Store | 제출 완료, 승인 대기 |
| SEO 잔여 (canonical/structured-data/noindex) | 대기 |
| 모바일 반응형 최종 점검 | 배포 후 실기기 확인 예정 |
| 오토마케터 전환 | 다음 작업 |

---

## 17. 2026-03-10 01:50 KST — 확장 자막 신뢰성/안정성 보강 + 분석 지연 튜닝

### Chrome Extension (YouTube)
- `chrome-extension/content.js`
  - **method2 패널 폴백 타임스탬프 보강**: `collectPanelItems`에서 자막 패널 시간 텍스트를 초 단위로 파싱하고, 다음 세그먼트 시작 시각 기반으로 `duration` 계산.
  - **네비게이션/삽입 루프 안정화**: 동일 URL/동일 영상 조건에서 중복 reset 및 버튼 재삽입 재시도 방지.
  - **비대상 페이지 보호**: watch/shorts 외 페이지에서 재시도 루프 중단 및 상태 정리.

### AI 분석 지연 최적화
- `lib/gemini.ts`
  - **사전 요약 스킵 범위 확대**: 중간 길이 자막에 대해 불필요한 pre-summary 호출을 줄여 지연 완화.
  - **thinking budget 하향**: 프로파일 기반으로 추론 예산을 낮춰 평균 응답 시간을 개선.

### 비고
- 이번 변경은 **분석 품질(점수/챕터 로직) 저하 없이** 안정성과 응답 속도 개선을 목표로 적용.

---

## 18. 2026-03-30 00:50 KST — 확장팩 자막 추출 대폭 강화 + 분석이유서 3항 누락 수정 + 보안

### Chrome Extension — 자막 추출 5단계 폴백 (`main-world.js`)
기존 `/player` API + `ytInitialPlayerResponse` 2단계에서 **5단계**로 확장:
1. `/player` API + `signatureTimestamp(sts)` 포함 → 캡션 응답 완전성 확보
2. `ytplayer` 런타임 객체 (`raw_player_response`, `bootstrapPlayerResponse`) → SPA 전환 후에도 최신 데이터
3. watch 페이지 HTML 직접 fetch → `ytInitialPlayerResponse` 파싱 (가장 확실)
4. YouTube `timedtext` list API 직접 호출 (`/api/timedtext?type=list`)
5. `/next` 응답 재귀 deep search → YouTube 구조 변경에도 `getTranscriptEndpoint.params` 탐색

- MWEB 클라이언트 버전: `2.20240101` → `2.20250101`
- ANDROID 클라이언트 버전: `19.09.37` → `19.29.37`

### Chrome Extension — 검은 오버레이 제거 + UX (`content.js`)
- `method2_panel` 실행 중 `tp-yt-iron-overlay-backdrop` CSS 강제 숨김 주입 → 검은막 깜빡임 완전 제거
- `closeEngagementPanels()` 공격적 정리 (click, Escape, backdrop remove, dropdown hide, body overflow 복원)
- 자막 없는 영상 조기 차단: `alert('이 영상은 자막이 제공되지 않아...')` + 분석 중단 (서버 요청 방지)

### Chrome Extension — 스토어 리젝 대응 (`manifest.json`)
- 미사용 `scripting` 권한 제거 → 정책 위반 해소
- v1.0.0 → v1.0.1 버전 업 후 Chrome Web Store 재제출 완료 (검토 대기 중)

### 본진 — evaluationReason 3번(신뢰도 총평) 누락 수정 (`lib/gemini.ts`)
- **프롬프트 강화**: JSON 스키마 내 주석 + `[evaluationReason 필수 규칙]` 섹션 추가 ("항목 하나라도 누락하면 불합격")
- **후처리 자동 보완**: Gemini가 3번 누락 시 `reliability` 점수 기반으로 자동 생성 (`/3\.\s*신뢰도\s*총평/` 체크)

### 본진 — Supabase RLS 보안 수정
- **RLS 활성화** (에러 3건): `t_video_subscriptions`, `bot_aggro_keywords`, `bot_keyword_videos`
- **과도한 정책 제거** (경고 3건):
  - `t_analyses`: 중복 SELECT 정책 4개 + INSERT 정책 1개 삭제 (all `USING(true)`)
  - `t_magic_links`: `authenticated_all`, `service_role_all` 삭제
  - `t_payment_logs`: `authenticated_all`, `service_role_all` 삭제
- 3개 테이블 모두 서버(service_role)에서만 접근하므로 클라이언트 차단, 기능 영향 없음

### 커밋
- `28c148f`: 본진 + 확장팩 + 오토마케터 일괄 배포
- `37e2527`: v1.0.1 버전 업

---

## 19. 2026-04-26 14:00 KST — 리셋 후 재시작 전략 (Hydration 안정화 우선)

### 배경
- 로그인 이후 hydration mismatch가 반복 발생하여, 임시 패치 누적을 중단.
- `9afc933` 기준으로 워킹트리를 리셋하고 1단계부터 재검증하는 방식으로 전환.

### 핵심 운영 원칙
1. hydration 안정화 전 기능 추가 금지
2. 로그인 모달 구조 단일화 (전역 1개 또는 페이지별 1개)
3. 렌더 단계에서 `window`/`localStorage` 분기 금지
4. mounted 가드 최소 적용 (필요 지점 한정)
5. 검증 순서 고정: `/` → `/p-settings` → `/p-notification`

### 변경된 전략: 분석 API 2분리
- **Request API**: `POST /api/analysis/request`
  - 요청 접수, 최소 검증, `analysisId` 발급, 즉시 응답
- **Result API**: `GET /api/analysis/result/[id]`
  - 상태 조회(폴링), 부분/최종 결과 반환

목표:
- 초기 렌더 안정성과 무거운 분석 처리를 분리해 hydration 리스크 축소
- 로그인/모달/페이지 전환 구간에서 SSR/CSR 트리 불일치 최소화

### 1단계 실행 기준
- 목표: 로그인 후 `/p-settings` 진입까지 hydration error 0
- 고정 검증:
  1) 익명 `/` 첫 진입
  2) 테스트 로그인 (`test@aggrofilter.com` / `111111`)
  3) `/p-settings` 진입
  4) 새로고침 후 동일 시퀀스 반복