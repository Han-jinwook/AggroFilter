# AggroFilter AutoMarketer

어그로필터 자동 마케팅 봇 — 매일 한국어 트렌드 영상을 수집하고 메인 앱 API로 자동 분석하여 DB를 채웁니다.

## 구조

```
aggro-marketing-bot/
├── src/
│   ├── index.js          # 스케줄러 (오전 6시 / 오후 6시)
│   ├── run-once.js       # 즉시 1회 실행
│   ├── job.js            # 메인 잡 로직 (수집 → 중복제거 → 분석)
│   ├── youtube-collector.js  # YouTube API 트렌드 수집
│   ├── analyzer.js       # 메인 앱 /api/analysis/request 호출
│   ├── db.js             # 중복 체크용 DB 조회
│   └── config.js         # 환경변수 로드 및 설정
├── .env                  # 환경변수 (직접 생성 필요)
├── .env.example          # 환경변수 예시
└── package.json
```

## 초기 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일 생성 후 값 입력:

```bash
copy .env.example .env
```

| 변수 | 설명 |
|------|------|
| `YOUTUBE_API_KEY` | Google Cloud Console에서 발급한 YouTube Data API v3 키 |
| `MAIN_APP_URL` | 메인 앱 URL (기본값: `https://aggrofilter.com`) |
| `DATABASE_URL` | 메인 앱과 동일한 PostgreSQL 연결 문자열 |
| `ANALYSIS_DELAY_MS` | 분석 요청 간 딜레이 ms (기본값: 5000) |
| `MAX_VIDEOS_PER_CATEGORY` | 카테고리별 최대 수집 수 (기본값: 5) |
| `DEDUP_DAYS` | 중복 방지 기준 일수 (기본값: 7) |

### 3. YouTube API 키 발급 방법

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. **API 및 서비스 → 라이브러리** → `YouTube Data API v3` 활성화
4. **API 및 서비스 → 사용자 인증 정보** → API 키 생성
5. 생성된 키를 `.env`의 `YOUTUBE_API_KEY`에 입력

> ⚠️ YouTube Data API v3 무료 할당량: **하루 10,000 유닛**
> 검색 1회 = 100유닛, 영상 상세 1회 = 1유닛
> 카테고리 7개 × 2회 기준 약 1,400유닛 소모 → 무료 한도 내 충분

## 실행

### 즉시 테스트 (1회 실행)

```bash
node src/run-once.js
```

### 스케줄러 상시 실행 (오전 6시 / 오후 6시 자동)

```bash
node src/index.js
```

> PC가 꺼져 있으면 스케줄이 실행되지 않습니다.
> 항상 켜두거나 Windows 작업 스케줄러로 `node src/index.js` 부팅 시 자동 시작하도록 설정하세요.

## 동작 흐름

```
[오전/오후 6시]
  ↓
[DB 중복 체크] 최근 7일 이내 분석된 videoId / channelId 조회
  ↓
[YouTube 수집] 카테고리별 키워드로 최근 12시간 내 영상 검색 (한국어, KR)
  ↓
[중복 필터링] 이미 분석된 영상/채널 스킵
  ↓
[순차 분석] 메인 앱 /api/analysis/request 호출
            userId='bot', 5초 딜레이로 Rate Limit 방어
  ↓
[자동 노출] DB Insert 즉시 플라자/랭킹 페이지에 반영
```

## 봇 분석 데이터 필터링

봇이 분석한 데이터는 DB에서 `f_user_id = 'bot'` 조건으로 구분 가능합니다.

```sql
-- 봇이 분석한 영상 조회
SELECT * FROM t_analyses WHERE f_user_id = 'bot' ORDER BY f_created_at DESC;

-- 봇 제외 실제 유저 분석만 조회
SELECT * FROM t_analyses WHERE f_user_id != 'bot' OR f_user_id IS NULL;
```
