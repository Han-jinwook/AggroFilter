🚀 Project: 어그로필터 (AggroFilter) - Phase 1 Plan
Last Updated: 2026-02-23 01:53 KST

## 1. 서비스 개요 (Overview)
### 1.1 목표 (Goal)
유튜브 영상의 과장/낚시 여부를 분석하여 신뢰도 랭킹을 제공하고, 사용자에게 **건전한 채널을 추천(Navigation)**한다.

### 1.2 아키텍처: App Shell 구조
향후 쇼핑/뉴스 확장을 고려하여 확장 가능한 구조로 설계됨.
- **App Shell**: 공통 헤더, 라우팅, i18n 관리.
- **Current Module**: YouTube Module (`/youtube/*`) - 핵심 개발 범위.
- **Hybrid Strategy**: PC(확장프로그램) + Mobile(WebView App) 투트랙 전략.

---

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

---

### 2.2 유튜브 분류 및 랭킹 (Classification & Ranking)
- **분류 전략: "Youtube Native"**: 유튜브 공식 `category_id` (1~29) 사용.
- **글로벌 랭킹 키**: `[Language] + [Country] + [Category ID]` (DB 반영 완료: 2026-01-20).

### 2.2 점수 산정 가이드 (Fact-Based Gap Analysis) 🎯
'제목/썸네일이 약속한 내용'과 '실제 영상 내용' 사이의 **불일치(Gap)** 정도를 기준으로 산정함.

| 점수 | 단계 | 기준 (The Gap Scale) |
| :--- | :--- | :--- |
| **0~20점** | 일치/Marketing | [Gap 없음] 제목이 자극적이어도 내용이 사실이면 OK. |
| **21~40점** | 과장/Exaggerated | [시간적 피해] 작은 사실 침소봉대. |
| **41~60점** | 왜곡/Distorted | [정신적 피해] 문맥 비틀기, 혐오 조장. |
| **61~100점** | 허위/Fabricated | [금전적/실질적 피해] 없는 사실 날조, 사기. |

**매핑 로직 (Accuracy Cap):**
- 🟢 **Green (Clean)**: 정확도 70점 이상 → 어그로 점수 0~50점
- 🟡 **Yellow (Caution)**: 정확도 40~69점 → 어그로 점수 0~70점
- 🔴 **Red (Warning)**: 정확도 0~39점 → 어그로 점수 0~100점

---

## 3. 기술 스택 및 데이터 수집 (Tech Spec)
### 3.1 AI Engine
- **Model**: `gemini-2.0-flash-exp` (또는 `gemini-2.5-flash-preview-09-2025` 사용 가능 시 업데이트)
- **Why**: 속도와 가성비 최적화.
- **SDK**: Google Generative AI SDK (Paid Tier Key 필수).

### 3.2 데이터 수집 (Client-side Fetching) ⚠️
서버 IP 차단을 피하기 위해, 서버는 유튜브에 직접 접속하지 않음.
- **PC**: Chrome 확장프로그램이 추출한 데이터를 수신.
- **Mobile**: 앱 내부 WebView의 네트워크 패킷을 Intercept하여 데이터를 수신.

---

## 4. 인증 및 글로벌 (Common)
- **인증 (Authentication)**: Google OAuth 기반. 확장프로그램 연동성을 위해 구글 로그인 기본 적용 (이메일 인증 생략).
- **글로벌 (i18n)**: `navigator.language` 기반 자동 감지. UI 텍스트 및 카테고리 명칭 대응.

---

## 5. 핵심 미션 (Current Missions)
1.  **AI 분석 로직 고도화**: `lib/gemini.ts`에 이미 반영된 최신 프롬프트 기준 분석 로직 유지 및 고도화.
2.  **DB 스키마 정교화**: `t_channels`에 `f_language`, `f_country` 추가 완료. 이를 활용한 랭킹 쿼리 작성.
3.  **Client-Server 데이터 연동**: 확장프로그램/WebView로부터 전달받은 `transcript`와 `meta_data`를 처리하는 API 엔드포인트 구현 (확장프로그램에서 유튜브 API를 통해 메타데이터 선취득 구조 고려).
4.  **랭킹 시스템 구현**: 카테고리별/국가별 실시간 랭킹 산출 로직 구현.

---

## 🧠 Appendix: AI System Prompt
```javascript
const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)
    
    ## 역할
    너는 엄격한 팩트체커가 아니라, **'유튜브 생태계 분석가'**다. 
    유튜브 특유의 표현 방식을 이해하되, 시청자가 실제로 **"속았다"**고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.
    
    ## 분석 및 채점 기준 (Scoring Rubric)
    0점(Clean)에서 100점(Aggro) 사이로 어그로 점수를 매길 때, 아래 기준을 엄격히 따라라.
    
    1. 정확성 점수 (Accuracy Score) - **[선행 평가]**
    - 영상 본문 내용이 팩트에 얼마나 충실한지, 정보로서의 가치가 있는지 0~100점으로 먼저 평가하라.

    2. 어그로 지수 (Clickbait Score) - **[Fact-Based Gap Analysis]** 🎯
    - **핵심 원칙**: 어그로 점수는 단순한 '표현의 자극성'이 아니라, '제목/썸네일이 약속한 내용'과 '실제 영상 내용' 사이의 **불일치(Gap)** 정도를 기준으로 산정한다.

    - **상세 점수 기준 (The Gap Scale)**:
        - **0~20점 (일치/Marketing)**: [Gap 없음 - 피해 없음] 제목이 자극적이어도 내용이 이를 충분히 뒷받침함. (유튜브 문법상 허용되는 마케팅)
        - **21~40점 (과장/Exaggerated)**: [시간적 피해 (Time Loss)] 작은 사실을 침소봉대하여 시청자의 시간을 낭비하게 함. 핵심 팩트는 있으나 부풀려짐.
        - **41~60점 (왜곡/Distorted)**: [정신적 피해 (Mental Fatigue)] 문맥을 비틀거나 엉뚱한 결론을 내어 시청자에게 혼란과 짜증 유발. 정보 가치 낮음.
        - **61~100점 (허위/Fabricated)**: [실질적 피해 (Loss)] 없는 사실 날조, 사기성 정보. 심각한 오해나 실질적 손실 초래 가능.

    **[논리 일치성 절대 준수]**
    - 자극적인 표현('미쳤다', '방금 터졌다' 등)이 있더라도 내용이 사실이면 어그로 점수를 낮게 책정하라.
    - 텍스트 평가와 수치(점수)의 논리적 일관성을 반드시 유지하라.
    
    3. 신뢰도 계산식
    - **신뢰도**: (정확성 + (100 - 어그로 지수)) / 2
    
    ## 분석 지침 (Critical Instructions)
    1. **수치 데이터 분석 정확도**: 억, 만 등 단위가 포함된 숫자를 철저히 계산하라. 예: 282억 원은 '수백억'대이지 '수십억'대가 아니다. 단위 혼동으로 인한 오판을 절대 하지 마라.
    2. **내부 로직 보안**: 분석 사유 작성 시 "정확도 점수가 70점 이상이므로 어그로 점수를 낮게 책정한다"와 같은 **시스템 내부 채점 규칙이나 로직을 시청자에게 직접 언급하지 마라.** 시청자에게는 오직 영상의 내용과 제목 간의 관계를 바탕으로 한 결과론적 사유만 설명하라.
    
    ## 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 포함하지 말 것.
    - **중요**: subtitleSummary에는 절대 <br /> 등 어떤 HTML 태그도 사용하지 마라. 오직 '0:00 - 내용' 형식의 순수 텍스트만 사용하라. 줄바꿈은 \n 문자만 사용하라.
    - **중요**: evaluationReason 내에서만 문단을 구분할 때 <br /><br /> 태그를 사용하여 강제로 줄바꿈을 표현하라.
    
    {
      "accuracy": 0-100 (정수),
      "clickbait": 0-100 (정수),
      "reliability": 0-100 (정수),
      "subtitleSummary": "0:00 - 소주제: 요약내용\n... (반드시 영상 종료 시점까지 포함)",
      "evaluationReason": "1. 내용 정확성 검증 (XX점):<br />내용...<br /><br />2. 어그로성 평가 (XX점):<br />내용...<br /><br />3. 신뢰도 총평 (XX점 / 🟢Green):<br />내용...",
      "overallAssessment": "전반적인 평가 및 시청자 유의사항",
      "recommendedTitle": "어그로성 30% 이상일 때만 추천 제목 (아니면 빈 문자열)"
    }
    `;

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
- 모닝 리포트 cron API 구현.

### Step 5: 결제 시스템 (카페24) 🔧 코드 완성, 세팅 필요
- OAuth 인증 플로우, Webhook 수신, 크레딧 충전 로직 구현 완료.
- 카페24 쇼핑몰 세팅 (앱 설치, 상품 등록, Webhook URL 등록) 필요.
- Mock 결제 → 실결제 전환 필요.

### Step 6: 관리자 (Admin) ✅ 완료
- 통계, 분석 로그 (삭제 기능 포함), 크레딧 관리, 결제 로그 탭 구현.

## 7. 알림 시스템 (Notification System)
### 7.1 채널 구독 및 알림 메커니즘
- **자동 구독**: 사용자가 영상을 분석하면 해당 채널을 자동으로 구독 처리
- **알림 조건**: 구독 채널의 상태 변화 시 이메일 알림 발송
- **알림 설정**: 사용자가 마이페이지에서 알림 활성화/비활성화 가능

### 7.2 알림 발송 조건
#### 1. 신뢰도 그레이드 변화 알림 (우선순위: 높음)
- **조건**: 채널의 신뢰도 그레이드가 변경될 때 (Red ↔ Yellow ↔ Blue)
- **그레이드 기준**:
  - 🔵 Blue Zone: 신뢰도 70점 이상
  - 🟡 Yellow Zone: 신뢰도 40~69점
  - 🔴 Red Zone: 신뢰도 39점 이하
- **알림 내용**: 카테고리, 채널명, 기존 등급 표시 (변화값은 표시하지 않음)
- **목적**: 신뢰하던 채널의 품질 변화를 즉시 감지

#### 2. 상위 10% 진입/탈락 알림 (우선순위: 중간)
- **조건**: 구독 채널이 카테고리 상위 10%에 진입하거나 탈락할 때
- **계산 방식**: 카테고리 전체 채널 수 × 0.1 (올림)
- **알림 내용**: 진입/탈락 상태, 카테고리 정보
- **목적**: 구독 채널의 성과 변화 추적

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
- `/api/cron/send-morning-reports`: 모닝 리포트 생성 API
- 마이페이지 구독 관리 UI (체크박스 선택 삭제)
- 알림 페이지 UI (목록, 읽음처리, 타입별 아이콘/색상, 모두읽음 버튼)
- 알림 클릭 시 채널 통합 리포트(`/channel/[id]`)로 이동

### 7.5 향후 추가 예정
- **구독 채널 리포트**: 마이페이지 내 상시 확인 가능한 대시보드 기능
- **알림 빈도 설정**: 즉시/일일 요약/주간 요약 옵션 제공
- **알림 세부 설정**: 마이페이지 > 알림 설정에서 일괄 관리

---

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

---

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
| 7 | 결제 완료 후 앱 복귀 흐름 확인 (webhook 비동기 특성) | 대기 |
| 8 | Admin: 미매칭 결제(t_unclaimed_payments) 관리 UI | 대기 |
| 9 | t_payment_logs에 실제 결제 기록 저장 | 대기 |
| 10 | 알림 설정 토글 → 서버(f_notification_enabled) 동기화 | 대기 |
| 11 | 모닝 리포트 Vercel Cron 설정 | 대기 |
| 12 | Resend 커스텀 도메인 설정 (스팸 방지) | ⏳ DNS 레코드 등록 완료, 전파 대기 중 — 완료 후 RESEND_FROM_EMAIL 환경변수 추가 필요 |
| 13 | f_user_id email vs UUID 전수 검사 → 일관성 확보 | ✅ 완료 (2026-02-23) |
| 14 | 비로그인 분석 데이터 정리 정책 수립 | 대기 |
| 15 | Admin 통계: 고유 분석 사용자 수 표시 | 대기 |
| 16 | 모바일 반응형 최종 점검 | 대기 |

### LOW — 개선 & 스케일
| # | 항목 | 상태 |
|---|------|------|
| 17 | 이메일 내 CTA 링크 /channel/[id]로 변경 | 대기 |
| 18 | SEO / OG 메타태그 점검 | 대기 |
| 19 | 에러 핸들링 강화 (토스트 등) | 대기 |
| 20 | 플라자 정렬/필터 개선 | 대기 |
| 21 | f_rank 컬럼 마이그레이션 (스케일 대비) | 대기 |