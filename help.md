@@
# Auto Marketer 시스템 구현 현황

> **작성자**: Cascade AI
> **작성일**: 2026-02-03 21:55
> **목적**: 기획팀(Jemini) 리뷰용

---

## 1. 목표

유튜브 영상 분석 데이터를 기반으로 마케팅 콘텐츠(숏폼 대본, 보도자료 등) 생성을 자동화하여, 수작업을 최소화하고 시의성 있는 콘텐츠를 신속하게 발행하는 것을 목표로 합니다.

## 2. 전체 아키텍처

시스템은 크게 3단계의 파이프라인으로 구성됩니다.

-   **Phase 1: Collector (수집)**: 매일 자동으로 유튜브 인기 동영상을 수집하고 분석 큐에 등록합니다.
-   **Phase 2: Miner (발굴)**: 분석이 완료된 데이터베이스에서 마케팅적으로 활용 가치가 높은 '소재'를 필터링합니다.
-   **Phase 3: Crafter (생성)**: 발굴된 소재를 바탕으로, Gemini AI를 통해 실제 마케팅 원고를 생성합니다.

## 3. 세부 구현 내용

### Phase 1: 데이터 수집기 (Collector)

-   **어드민 UI (`/p-admin`)**:
    -   'Data Collector', 'Insight Miner', 'Content Crafter' 3단 탭 구조로 페이지를 리팩토링했습니다.
    -   `Data Collector` 탭에서 **수동 수집 실행**이 가능하도록 UI(예산 설정, 카테고리 선택)와 기능을 구현했습니다.
-   **수동 수집 API (`/api/admin/collect-manual`)**:
    -   관리자가 선택한 카테고리의 인기 동영상 50개를 수집하여 DB(`t_videos`)에 저장하고, 분석 큐에 추가하는 API를 구현했습니다.
-   **자동 수집 (Cron Job)**:
    -   매일 자정(KST)에 자동으로 동영상 수집/분석을 실행하는 **Supabase Edge Function** (`collect-and-analyze-videos`)을 생성했습니다.
    -   PostgreSQL의 `pg_cron` 확장을 사용하여 이 함수를 주기적으로 호출하는 SQL 스크립트 (`sql/collector_cron_job.sql`)를 작성했습니다.

### Phase 2: 소재 마이닝 (Miner)

-   **어드민 UI (`/p-admin`)**:
    -   `Insight Miner` 탭에서 '어그로 점수 80점 이상' 등과 같은 **조건별로 소재를 필터링**하는 UI를 구현했습니다.
    -   발굴된 소재는 썸네일, 제목, 점수, 추천 사유가 포함된 **카드 형태**로 표시됩니다.
-   **소재 발굴 API (`/api/admin/mine-materials`)**:
    -   '소재 추출 실행' 버튼과 연동되어, 설정된 조건에 따라 `t_analysis_history` 테이블에서 유의미한 데이터를 조회하는 API를 구현했습니다.

### Phase 3: 콘텐츠 생성 (Crafter)

-   **어드민 UI (`/p-admin`)**:
    -   `Insight Miner`에서 '콘텐츠 생성하기' 버튼을 누르면, 해당 소재 정보가 `Content Crafter`로 전달되며 **탭이 자동으로 전환**되는 워크플로우를 구현했습니다.
    -   `Content Crafter`는 전달받은 소재의 제목과 점수를 표시하고, '숏폼 대본', '보도자료/칼럼' 등 생성할 **콘텐츠 유형을 선택**할 수 있습니다.
-   **콘텐츠 생성 API (`/api/admin/generate-content`)**:
    -   선택된 소재 ID와 콘텐츠 유형을 받아, **Gemini Pro AI**를 호출하는 API를 구현했습니다.
    -   AI 프롬프트는 특정 영상의 분석 데이터(제목, 채널명, AI 평가 이유 등)를 활용하여, 페르소나(예: 팩트체크 유튜버)에 맞는 매력적인 원고를 생성하도록 설계되었습니다.
-   **DB 연동**:
    -   AI가 원고 생성을 완료하면, `t_marketing_materials` 테이블에 해당 내용을 저장하고 상태를 'DRAFT'에서 'GENERATED'로 업데이트하는 로직을 추가했습니다.

## 4. 데이터베이스

-   마케팅 소재와 생성된 콘텐츠를 관리하기 위한 `t_marketing_materials` 테이블 스키마를 설계하고, `sql/auto_marketer_schema.sql` 파일로 추가했습니다.

## 5. 최종 확인 및 실행 필요 사항

시스템이 완전히 동작하려면 다음 작업이 필요합니다.

1.  **데이터베이스 스키마 적용**:
    -   `sql/auto_marketer_schema.sql`
    -   `sql/collector_cron_job.sql`
    -   위 두 파일의 내용을 Supabase 'SQL Editor'에서 실행해야 합니다. (Cron Job 스크립트의 `<PLACEHOLDER>` 값은 실제 정보로 교체 필요)
2.  **Edge Function 배포**:
    -   `supabase/functions/collect-and-analyze-videos` 함수를 Supabase CLI를 통해 배포해야 합니다.
3.  **환경 변수 설정**:
    -   Supabase 프로젝트 설정에서 `YOUTUBE_API_KEY`와 `GOOGLE_API_KEY`가 올바르게 설정되었는지 확인해야 합니다.

- **Endpoint URL**: `https://aggrofilter.netlify.app/api/cafe24/webhook`
- **이벤트(Events)**:
  - 필수: `order.updated` (주문 상태 변경 시 발생)
  - 권장: `order.created` (주문 생성 시 발생)
- **이유**: 사용자가 결제를 완료하여 **입금확인(Payment Status: T)** 상태가 되었을 때 크레딧을 지급하기 위함입니다. `order.created` 시점에는 미입금 상태일 수 있으므로 `order.updated`가 필수입니다.

### 2. 크레딧 상품 ID 매핑 확인
- Netlify 환경변수 `CAFE24_CREDIT_PRODUCT_MAP`에 등록된 상품 번호와 실제 Cafe24 쇼핑몰 상품 번호가 일치하는지 확인.
- 예: `{"123": 100, "124": 500}` (상품번호 123 구매 시 100크레딧, 124 구매 시 500크레딧)

### 3. 테스트 시나리오
1. Cafe24 쇼핑몰에서 크레딧 상품을 주문합니다.
2. (무통장입금의 경우) 관리자 페이지에서 '입금확인' 처리합니다.
3. Webhook이 발송되면 AggroFilter 서버가 이를 수신합니다.
4. `t_users` 테이블의 해당 이메일 유저의 `f_recheck_credits`가 증가했는지 확인합니다.

---

## 현재 환경변수(중요)
- `CAFE24_MALL_ID` = `nwjddus96`
- OAuth 시작: `app/api/cafe24/oauth/start/route.ts`
- OAuth 콜백: `app/api/cafe24/oauth/callback/route.ts`
- OAuth 상태 확인: `app/api/cafe24/oauth/status/route.ts`
- Webhook 수신: `app/api/cafe24/webhook/route.ts`
- Cafe24 API/토큰/주문조회 로직: `lib/cafe24.ts`

---

## 현재 환경변수(중요)
- `CAFE24_MALL_ID` = `nwjddus96`
- `CAFE24_CLIENT_ID` = (Netlify에 설정)
- `CAFE24_CLIENT_SECRET` = (Netlify에 설정)
- `CAFE24_REDIRECT_URI` = `https://aggrofilter.netlify.app/api/cafe24/oauth/callback`
- `CAFE24_OAUTH_SCOPE` = `mall.read_order`
- `CAFE24_WEBHOOK_SECRET` = (Netlify에 설정)
- `CAFE24_CREDIT_PRODUCT_MAP` = (상품번호→크레딧 매핑 JSON)

---

## Cafe24 개발자센터 설정(확인된 것)
- 앱 Redirect URI(s)에 다음이 등록되어 있음:
  - `https://aggrofilter.netlify.app/api/cafe24/oauth/callback`
- 앱 권한(쇼핑몰 운영자)에서 `주문(Order) Read` 권한을 추가함

---

## 디버그 확인 결과(확정된 사실)
`/api/cafe24/oauth/start?debug=1` 응답:
- `redirectUri`: `https://aggrofilter.netlify.app/api/cafe24/oauth/callback`
- `scope`: `mall.read_order`
- `authUrl`에도 동일 값이 포함되어 있음

즉, **서버가 Cafe24에 보내는 authorize 요청 파라미터는 정상**임.

---

## 코드 변경/시도했던 것들
- Netlify 빌드 실패 해결: `/payment/mock`의 `useSearchParams()`를 `<Suspense>`로 감쌈
- OAuth callback에서 `error`/`error_description`을 그대로 반환하도록 개선
- OAuth start에 `scope` 파라미터 추가
- scope 표기 문제 해결:
  - `mall_read_order` → `mall.read_order` 로 전환
  - 개발자센터 앱 권한에서도 주문 Read 추가
- 토큰 교환 401 대응 완료:
  - (1차) Header Basic Auth: 401 실패
  - (2차) Body Parameters (client_id/secret): 401 invalid_request 실패
  - (3차 - 성공 추정) Header Basic Auth로 롤백 + `.trim()` 적용
    - 결과: 에러 JSON 없이 메인 페이지(`/?code=...`)로 리다이렉트됨 -> **성공 유력**

---

## 남은 의심 포인트(다음 세션에서 집중)
- 현재 성공한 것으로 보이므로, 실제 토큰이 DB에 잘 저장되었는지 확인만 남음.

---

## 다음 세션 체크리스트(순서대로)
1) **최종 성공 확인**
   - `https://aggrofilter.netlify.app/api/cafe24/oauth/status` 접속
   - `configured: true`가 뜨는지 확인.

2) 만약 `true`라면, 다음 단계인 **Webhook 연동 테스트**로 넘어갈 준비 완료.

---

## 관련 파일
- `app/api/cafe24/oauth/start/route.ts`
- `app/api/cafe24/oauth/callback/route.ts`
- `app/api/cafe24/oauth/status/route.ts`
- `lib/cafe24.ts`
- `app/api/cafe24/webhook/route.ts`
