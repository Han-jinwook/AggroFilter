# 📱 NEW: 모바일-PC 크로스디바이스 분석 브릿지 명세 (PWA-Extension Handoff)

본 문서는 모바일 환경의 자막 추출 제약(유튜브 모바일 UI 및 PWA에서의 innertube get_transcript 제한)을 우회하고 크로스 디바이스 연속성을 실현하기 위해 구현된 **Handoff(브릿지) 분석 예약 시스템**의 공식 상세 명세서입니다.

나중에 어그로필터 정식 테스트 및 릴리즈 순서가 되었을 때 본 명세를 참고하여 유효성 검증을 진행합니다.

---

## 1. 시스템 아키텍처 & 흐름 (Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant PWA as 모바일 PWA
    participant API as 어그로필터 백엔드
    participant DB as Supabase DB
    participant PC as PC 크롬 확장팩

    User->>PWA: 유튜브 앱에서 [공유] 클릭 또는 URL 직접 입력
    PWA->>API: 1. 캐시 히트 체크 (status API)
    alt 캐시 히트 (기 분석 영상인 경우)
        API-->>PWA: 분석 ID 반환
        PWA-->>User: 결과 상세 화면(/p-result?id=UUID) 즉시 노출 (대기시간 0)
    else 캐시 미스 (신규 영상인 경우)
        PWA->>API: 2. Zero-Cost 채널 메타 추출 요청 (/api/channel/extract)
        API-->>PWA: 채널명 및 채널 ID (UC...) 반환 (유튜브 쿼터 소모 제로)
        PWA->>API: 3. 해당 채널 전적 조회 (/api/channel/[id])
        API-->>PWA: 해당 유튜버의 과거 평균 신뢰도 등급, 어그로 위험도 반환
        PWA-->>User: 채널 전적 요약 카드 즉시 노출
        PWA->>API: 4. 대기열 등록 요청 (/api/analysis/queue) - 로그인 필수
        API->>DB: 5. t_analysis_queue 테이블에 'pending' 상태로 적재
        API-->>PWA: 대기 예약 완료 토스트 알림 ("보관함 저장 완료")
    end

    Note over User, PC: 사용자가 PC를 켜고 크롬(확장팩 활성화)을 실행하는 시점

    PC->>PWA: 6. 웹앱 마운트 시 확장프로그램 ID DOM 캡처 및 세션 토큰 동기화
    loop 5분 주기 백그라운드 폴링 (alarms)
        PC->>API: 7. 대기열 예약 영상 요청 (/api/analysis/queue?pendingOnly=true)
        API-->>PC: pending 영상 데이터 반환 (없으면 대기)
        PC->>API: 8. 큐 상태를 'processing'으로 갱신 (PATCH)
        PC->>API: 9. 서버 정밀 분석 API 호출 (/api/analysis/request - 서버사이드 자막 파싱)
        alt 분석 성공
            API->>DB: t_analyses 분석 결과 생성 및 큐 'completed' 업데이트
            PC-->>User: OS 네이티브 알림 발송 ("팩트체크 완료!")
            User->>PC: 알림 클릭 시 내 보관함(/p-library)으로 이동하여 상세 결과 열람
        else 분석 실패
            API->>DB: 큐 상태 'failed' 업데이트
        end
    end
```

---

## 2. 데이터베이스 스키마 (`t_analysis_queue`)

모바일 예약 영상과 PC 분석 싱크 상태를 관리하기 위해 Supabase DB에 신설된 마이그레이션 구조입니다.

- **테이블**: `t_analysis_queue`
- **인덱스**:
  - `idx_analysis_queue_user_status`: `(f_user_id, f_status)` -> 보관함 조회 성능 극대화
  - `idx_analysis_queue_video_id`: `(f_video_id)` -> 중복 등록 방지 및 캐시 매칭 속도 개선
  - `idx_analysis_queue_status`: `(f_status)` -> 백그라운드 폴링 최적화

| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `f_id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | 대기열 항목 고유 식별자 |
| `f_user_id` | `UUID` | `NOT NULL, REFERENCES family_users(id)` | 예약 요청한 유저 고유 ID (SSO 세션 기반) |
| `f_video_url` | `VARCHAR(512)` | `NOT NULL` | 유튜브 원본 비디오 URL |
| `f_video_id` | `VARCHAR(50)` | `NOT NULL` | 유튜브 비디오 고유 ID (11자리) |
| `f_status` | `VARCHAR(20)` | `DEFAULT 'pending'` | 상태값 (`pending` / `processing` / `completed` / `failed`) |
| `f_created_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | 예약 생성 시점 |
| `f_updated_at` | `TIMESTAMPTZ`| `DEFAULT NOW()` | 마지막 상태 갱신 시점 |

---

## 3. 백엔드 API 명세

### 3-1. Zero-Cost 유튜브 채널 정보 추출 API
- **Endpoint**: `POST /api/channel/extract`
- **설명**: 유튜브 Data API v3 쿼터를 아끼기 위해 oEmbed 및 채널 홈 HTML의 `og:url` / `externalId` 패턴 매칭을 통해 채널 ID를 무료로 추출합니다.
- **Payload**: `{ "url": "영상 또는 채널 URL" }`
- **Response**: `{ "success": true, "channelId": "UC...", "channelName": "채널명" }`

### 3-2. 분석 대기열 관리 API
- **Endpoint**: `/api/analysis/queue`
- **동작**:
  - **GET**: 현재 로그인된 유저의 대기열 전체 목록 조회. (확장팩 호출용 `?pendingOnly=true` 파라미터 지원)
  - **POST**: 모바일 단독 진입 시 대기열에 pending 상태로 비디오 예약 적재. (중복 방지 처리 완비)
  - **PATCH**: 큐 상태 강제 업데이트 (`pending` ➡️ `processing` ➡️ `completed` or `failed`).
- **인증**: Merlin Hub JWT 토큰 검증(`Authorization: Bearer <token>`) 릴레이 연동.

---

## 4. 프론트엔드 연동 & UX 접점
- **Web Share Target API**: `public/manifest.json` 내 `share_target` 설정을 통해 모바일 기기(안드로이드, iOS PWA 등)의 기본 공유 메뉴에서 어그로필터를 선택해 유튜브 URL을 파라미터(`url` 혹은 `text`)로 자동 전송받음.
- **URL 캡처 폼 (`app/page.tsx`)**: 유입된 URL을 즉시 읽어 `handleSearch`를 트리거하고, 신규 채널인 경우 등급과 점수를 요약 카드 형태로 렌더링.
- **보관함 페이지 (`app/p-library/page.tsx`)**: 로그인한 사용자가 현재까지 예약한 영상들의 상태를 15초 단위 실시간 폴링을 통해 카드 뷰 형태로 제공.
- **세션 자동 동기화 (`components/c-app-header/index.tsx`)**: 어그로필터 사이트에 주입된 확장팩 Content Script가 박아둔 동적 ID(`div#aggrofilter-extension-info` 의 `data-extension-id`)를 웹앱이 마운트될 때 감지하여 로그인 토큰을 확장팩에 자동으로 갱신 릴레이(`SET_SESSION_TOKEN`).

---

## 5. 크롬 확장프로그램 (Chrome Extension)
- **권한 추가**: `manifest.json`에 `alarms`, `notifications` 추가 완료.
- **백그라운드 감시 서비스 워커 (`chrome-extension/background.js`)**:
  - 브라우저 부팅/설치 시 5분 주기의 알람(`queue-polling-alarm`) 등록.
  - 알람 실행 시 동기화되어 저장된 허브 세션 토큰을 헤더에 실어 `GET /api/analysis/queue?pendingOnly=true` 호출.
  - 예약 영상이 잡히면 상태를 `processing`으로 돌려놓고, 백그라운드에서 직접 서버 분석 API `/api/analysis/request`를 쏴서 팩트체크 수행.
  - 분석 완료 시 `completed`로 갱신 후 윈도우/MacOS 화면에 OS 네이티브 푸시 알림 발송. 알림 클릭 시 웹앱의 보관함 페이지로 즉시 탭 오픈 및 이관.

---

## 6. 자막 전송 안정성 및 도메인 가드 정책 (Race Condition & Domain Guard)

크롬 확장프로그램의 background Service Worker와 웹앱 간의 자막 데이터 통신(Handoff) 및 도메인 전환 시의 신뢰성을 담보하기 위해 도입된 상세 설계 규칙입니다.

### 6-1. 8초 자막 수신 대기 가드
- **레이스 컨디션 방지**: 확장팩 분석 버튼을 눌러 웹페이지가 마운트될 때, background Service Worker가 잠들어 있어(Cold Start) 자막 정보가 바로 도달하지 못하는 지연을 극복하기 위해 `ResultClient.tsx` 단에서 최대 8초 동안 자막 수신 포트(`MessageEvent`)를 열고 수신 대기합니다.

### 6-2. 자막 미수신 시 프론트엔드 API 차단 (입구컷)
- **서버 리소스 보호**: 8초 대기 후에도 자막 정보가 수신되지 않은 경우(`!clientTranscript`), 자막이 누락된 빈 요청을 백엔드 API(`/api/analysis/request`)로 쏘아 불필요한 과금 차감 및 YouTube 파서 실패(IP 차단 에러)를 유발하지 않도록 프론트엔드단에서 요청 발송을 즉각 거부(throw Error)합니다.
- **오류 안내**: 사용자 화면에 `"크롬 확장 프로그램으로부터 자막 데이터를 수신하지 못했습니다. 유튜브 페이지에서 새로고침(F5)을 하신 뒤 다시 분석 버튼을 눌러주세요."` 라는 행동 가이드를 노출하여 이탈을 예방합니다.

### 6-3. 구도메인(aggrofilter.com) 301 영구 리다이렉트
- **확장팩 matches 불일치 리스크 차단**: 사용자가 구버전 도메인(`aggrofilter.com`)으로 들어왔을 때는 크롬 확장팩 `manifest.json` 의 matches 규칙 제약 때문에 자막을 주입하는 `inject-transcript.js`가 아예 실행되지 않습니다.
- **자동 전환**: 미들웨어(`middleware.ts`)가 `aggrofilter.com` 호스트의 유입을 감지하는 즉시 공식 도메인(`aggrofilter.sundreamer.app`)으로 **301 영구 리다이렉트(301 Redirect)**를 실행하여 자막 연동 주입 기능이 무조건 실행될 수 있도록 도메인 환경을 정규화합니다.
