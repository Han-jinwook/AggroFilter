# 🚦 어그로필터 크롬 확장팩 (PC 전용 0초 분석 도구)

유튜브 영상 페이지에서 원클릭으로 AI 신뢰도 분석을 실행하고, 브라우저 내부 자막을 0초 만에 백엔드로 전달하는 크롬 확장 프로그램입니다.

---

## 🌟 핵심 기능

- **유튜브 영상 하단 원터치 버튼**: 유튜브 시청 중 영상 제목 바로 아래 `[🚦 어그로필터 분석]` 버튼 자동 삽입.
- **0초 무지연 자막 Handoff**: 브라우저 런타임 메모리에서 자막을 직접 추출하여 백엔드로 직송하므로, 대기열(Queue) 없이 즉시 분석 진입.
- **클라우드 캐시 자동 기여**: 확장팩으로 분석된 자막은 Supabase 원장(`t_caption_tasks`)에 자동 저장되어 모바일 유저들에게도 0초 즉시 재활용.
- **통합 계정 연동**: Merlin Hub 이메일 로그인 시 웹사이트 지갑(50C) 및 보관함과 완전 동기화.

---

## 🛠️ 설치 방법 (개발자 모드)

1. 크롬 브라우저에서 `chrome://extensions` 접속.
2. 우측 상단 **개발자 모드(Developer mode)** 스위치 ON.
3. 좌측 상단 **[압축해제된 확장 프로그램을 로드합니다]** 클릭.
4. `D:\AggroFilter\chrome-extension` 폴더 선택.
5. 유튜브 영상 페이지(`https://www.youtube.com/watch?v=...`) 새로고침 후 버튼 확인!

---

## 📁 파일 구조

```
chrome-extension/
├── manifest.json       # 확장팩 Manifest v3 설정
├── background.js       # Service Worker (API 통신 및 세션 중계)
├── content.js          # Content Script (유튜브 페이지 버튼 삽입)
├── content.css         # Content Script 스타일
├── popup.html          # 팝업 UI
├── popup.js            # 팝업 로직
└── icons/              # 아이콘 리소스 (16/48/128)
```

---

## 🔗 백엔드 API 연동

| 기능 | API 엔드포인트 | 비고 |
|------|---------------|------|
| 분석 요청 | `POST /api/analysis/request` | `clientTranscript` 직접 첨부 시 0초 분석 |
| 결과 조회 | `GET /api/analysis/result/[id]` | 점수 및 스포일러 조회 |
| 사용자 확인 | `GET /api/user/profile?email=` | Merlin Hub 세션 조회 |

---

*Last Updated: 2026-10-01 | Merlin Family OS*
