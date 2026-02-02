@@
# Cafe24 OAuth 설치/토큰발급 무한반복 이슈 정리 (AggroFilter 크레딧 충전)

## 목표
Cafe24 스토어에서 크레딧 상품 구매 시, Webhook 이벤트 기반으로 AggroFilter DB의 사용자 크레딧을 자동 충전.

현재 단계: **Cafe24 OAuth 설정 완료 (2026-01-30 해결)** → **Webhook 연동 및 테스트 단계 진입**

---

## 해결된 이슈 (OAuth)
- **증상**: 토큰 교환 시 401 Unauthorized 발생.
- **원인**: `Authorization: Basic` 헤더 필수 + 환경변수 공백(Whitespace) 이슈.
- **해결**: `.trim()` 적용 및 Basic Auth 방식으로 롤백하여 해결됨. (`configured: true` 확인 완료)

---

## 다음 단계: Webhook 설정 및 테스트 (필독)

### 1. Cafe24 개발자센터 설정
Cafe24 앱 설정 화면에서 **Webhook** 항목을 찾아 설정합니다.

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
