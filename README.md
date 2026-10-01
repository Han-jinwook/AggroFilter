# 🚦 어그로필터 (AggroFilter)

> **"유튜브의 어그로와 가짜뉴스를 10초 만에 꿰뚫어 보는 AI 신뢰도 팩트체커"**  
> 유튜브 영상의 제목, 썸네일, 자막을 AI로 정밀 분석하여 **어그로성, 정확성, 신뢰도 점수(0~100점)**와 **스포일러 요약**, **착한 대체 제목**을 제공하는 서비스입니다.

---

## 🌐 서비스 개요 및 도메인

- **공식 서비스 도메인**: [https://aggrofilter.sundreamer.app](https://aggrofilter.sundreamer.app)
- **통합 계정/과금 센터(허브)**: [https://os.sundreamer.app](https://os.sundreamer.app) (Merlin Hub)
- **인프라 토폴로지**: 
  - **프론트엔드/웹앱**: Netlify Pro (`aggrofilter.sundreamer.app`)
  - **허브 인프라**: Render (`os.sundreamer.app`)
  - **데이터베이스 (어그로필터 원장)**: Supabase PostgreSQL (`iwzwiimyxfduuwulpugu`)
  - **데이터베이스 (허브 통합 SSOT)**: Supabase PostgreSQL (`wwopcuitvjldixkyzpzi`)

---

## 🚀 2026 핵심 혁신: [모바일 완전 해방 & 하이브리드 로컬 큐]

과거 PC 크롬 확장팩에만 의존하던 자막 추출 제약을 완전히 극복하고, **모바일과 PC 어디서나 10초 만에 즉시 분석**할 수 있는 차세대 하이브리드 파이프라인을 구축했습니다.

### 📱 1. 모바일 10초 즉시 분석 (Web Share Target & PWA)
- **유튜브 앱 [공유] ➔ [어그로필터]**: 유튜브 시청 중 공유 버튼 하나로 즉각 10초 분석 실행.
- **메인 검색창 원터치**: 유튜브 링크를 붙여넣고 `Enter` 또는 **[⚡ 즉시 분석]** 클릭 시 0초 진입.
- **디바이스 자동 감지 온보딩**:
  - 모바일 접속 시: `[📱 모바일 10초 분석법]` 가이드 자동 표시.
  - PC 접속 시: `[🖥️ PC 크롬 확장팩 (0초 즉시 분석)]` 가이드 자동 표시.

### ⚡ 2. 하이브리드 로컬 워커 큐 (Hybrid Cloud-Local Caption Queue)
- **배경**: 클라우드 IP에 대한 유튜브 자막 스크래핑 차단(429/PO-token)을 원천 우회.
- **구조**: 가정용 초고속망 IP에서 상시 가동되는 레지던트 데몬(`scripts/caption_daemon.mjs`)과 Supabase 자막 큐(`t_caption_tasks`) 연동.
- **성능**: 1.5초 주기 고속 폴링(`FOR UPDATE SKIP LOCKED`) + 버스트 모드로 **평균 1.3초 만에 수천 줄 자막 추출 완결**.
- **무중단 운영**: Windows 백그라운드 데몬 루프(`run_caption_worker.bat`)로 비정상 종료 시 5초 내 자동 부활.

### ⏳ 3. [B안] 대기열 보관(202) & 사후 자동 완주
- 사용자가 분석 의뢰 시 로컬 데몬이 꺼져 있거나 지연되더라도, 에러(422)로 실패시키지 않고 **202 대기열 등록** 상태로 부드럽게 접수.
- **코인 철통 보호**: 대기열 등록 시 코인은 1원도 차감되지 않음 (0C).
- **자동 완주 & 이메일 알림**: 운영자가 데몬을 켜는 즉시 백로그를 감지하여 1초 만에 자막 추출 ➔ 백엔드 AI 분석 완료 ➔ Merlin Hub SDK를 통해 등록 이메일로 완료 알림 자동 발송.

---

## 🛡️ 입구컷 8종 게이트키퍼 & 자막 검증

AI 비용 누출을 99% 차단하고 서비스 품질을 보호하기 위한 철통 방어선:

1. **Title Guard (GPT-4o-mini)**: 0.2초/0.0008원 초경량 제목 검문.
2. **음원/음악 (MV/가사)**: 즉시 차단 (422).
3. **실시간 라이브/다시보기**: 진행 중 방송 및 저품질 녹화본 차단 (422).
4. **단순 게임 플레이**: 리뷰/논평 없는 단순 게임 플레이 차단 (422).
5. **스포츠 경기 중계**: 단순 중계/풀매치 차단 (422).
6. **단순 영화/공연 재생**: 전체보기 스트림 차단 (422).
7. **외국어/비한국어**: 일본어 가나 및 한글 미포함 영상 차단 (422).
8. **CC 자막 부재 (`NO_TRANSCRIPT`)**: 유튜브 CC 자막이 원천 제공되지 않는 영상 즉시 안내 (422).

---

## 🪙 패밀리 코인경제 & 멤버십 정책 (Hub v2.6 표준)

- **신규 영상 분석**: 영상 길이 불문 **일괄 50C 단일가** 차감 (토큰 종량제 미터기 완전 폐지).
- **소유자 재분석 의뢰 (`REANALYSIS_OWNER`)**: 채널 주인의 최신 재검수 요청 시 **1,000C 고정**.
- **캐시 열람**: 이미 분석 완료된 영상은 **0C 무료 열람** (단, 광고 노출).
- **광고 타임패스 (Ad-Free Timepass)**: 50C 분석 결제 즉시 **24시간 동안 사이드/하단 광고 100% 자동 제거**.
- **게스트 가불 정산**: 비회원 1회 무료 체험 ➔ 로그인 시 가불금 원자적 정산 및 소유권 즉시 이관.

---

## 📁 주요 디렉토리 구조

```
AggroFilter/
├── app/                        # Next.js 14 App Router
│   ├── api/analysis/request/   # AI 분석 요청 & 게이트키퍼 & 큐 연동
│   ├── p-result/               # 결과 화면 (투트랙 Speed/Full & 대기열 카드)
│   ├── p-library/              # 내 분석 보관함
│   ├── p-plaza/                # 실시간 분석 광장
│   └── p-ranking/              # 채널/영상 신뢰도 랭킹
├── chrome-extension/           # PC 유튜브 연동 크롬 확장 프로그램 (0초 자막 Handoff)
├── auto-marketer/              # 트렌드 영상 자동 수집 & 사전 분석 마케팅 봇
├── scripts/
│   ├── caption_daemon.mjs      # 로컬 자막 추출 상시 레지던트 데몬
│   └── run_caption_worker.bat  # 데몬 무중단 자동 재시작 배치 파일
├── docs/                       # 서비스 기능명세 및 아키텍처 공식 문서
└── src/services/merlin-hub-sdk/# Merlin Hub 통합 SDK (인증/세션/지갑/알림)
```

---

## 💻 로컬 개발 및 실행

### 웹앱 실행
```bash
npm install
npm run dev
# http://localhost:3000 접속
```

### 자막 워커 데몬 실행 (로컬 PC)
```bash
# Windows 상시 구동 (자동 재시작 지원)
run_caption_worker.bat

# 또는 단독 실행
node scripts/caption_daemon.mjs
```

---

*Last Updated: 2026-10-01 | Merlin Family Ecosystem*
