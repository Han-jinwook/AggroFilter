@@
# Cafe24 OAuth 설치/토큰발급 무한반복 이슈 정리 (AggroFilter 크레딧 충전)

## 목표
Cafe24 스토어에서 크레딧 상품 구매 시, Webhook 이벤트 기반으로 AggroFilter DB의 사용자 크레딧을 자동 충전.

현재 단계: **Cafe24 OAuth 설치(1회) → access/refresh token을 DB(t_cafe24_tokens)에 저장**하는 단계에서 무한 반복/에러 발생.

---

## 현재 증상
- **`/api/cafe24/oauth/start`로 설치 진행 후**
  - 동의 화면까지는 뜨기도 함
  - 동의 후 콜백에서 토큰 교환 실패(401/invalid_request 등) 발생
  - `/api/cafe24/oauth/status`는 계속 `configured: false` (토큰 미저장)

---

## 구현/엔드포인트 현황
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
- 토큰 교환 401 대응 시도:
  - (1차) Header Basic Auth: 401 실패
  - (2차) Body Parameters (client_id/secret): 401 invalid_request 실패 (Screenshot 확인됨)
  - (3차 - 현재) Header Basic Auth로 롤백하되 `.trim()` 적용 및 디버깅 정보(`usedRedirectUri` 등) 응답에 포함

---

## 남은 의심 포인트(다음 세션에서 집중)
1) **환경변수 공백 문제**
   - `CAFE24_CLIENT_SECRET` 등에 공백이 포함되어 Base64 인코딩이 틀어졌을 가능성 -> `.trim()`으로 대응.

2) **Redirect URI 불일치**
   - 디버깅 응답(`usedRedirectUri`)을 통해 코드와 실제 전송값이 일치하는지 확인 예정.

3) **Cafe24 개발자센터 설정 미반영**
   - 권한/Scope 설정이 즉시 반영되지 않았을 수도 있음.

---

## 다음 세션 체크리스트(순서대로)
1) 프로덕션 배포 완료 대기
2) **반드시 `/api/cafe24/oauth/start` 부터 새로 시작** (기존 콜백 URL 새로고침 금지 - code 재사용 불가)
3) 실패 시 반환되는 JSON의 `debug` 필드 확인
   - `usedRedirectUri`가 개발자센터 설정과 정확히 일치하는지.
   - `clientIdPrefix`가 맞는지.

---

## 관련 파일
- `app/api/cafe24/oauth/start/route.ts`
- `app/api/cafe24/oauth/callback/route.ts`
- `app/api/cafe24/oauth/status/route.ts`
- `lib/cafe24.ts`
- `app/api/cafe24/webhook/route.ts`
