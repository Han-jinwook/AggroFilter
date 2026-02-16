# 어그로필터 크롬 확장팩

유튜브 영상 페이지에서 바로 AI 신뢰도 분석을 실행할 수 있는 크롬 확장 프로그램입니다.

## 기능

- **유튜브 영상 페이지에 분석 버튼 자동 삽입** — 영상 제목 아래 "🚦 어그로필터 분석" 버튼
- **원클릭 분석** — 버튼 클릭 시 어그로필터 API로 분석 요청, 결과를 미니 카드로 표시
- **상세 결과 연동** — "상세 분석 보기" 클릭 시 어그로필터 웹사이트 결과 페이지로 이동
- **이메일 로그인** — 팝업에서 이메일 입력 시 웹사이트 계정과 분석 기록 연동

## 설치 방법 (개발자 모드)

1. 크롬 브라우저에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `chrome-extension` 폴더 선택
5. 유튜브 영상 페이지에서 버튼 확인!

## 아이콘 생성

`icons/generate-icons.html`을 브라우저에서 열어 PNG 아이콘을 다운로드한 후 `icons/` 폴더에 저장하세요.

- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## 파일 구조

```
chrome-extension/
├── manifest.json       # 확장팩 설정
├── background.js       # Service Worker (API 통신)
├── content.js          # Content Script (유튜브 페이지 버튼 삽입)
├── content.css         # Content Script 스타일
├── popup.html          # 팝업 UI
├── popup.js            # 팝업 로직
├── icons/              # 아이콘
│   ├── generate-icons.html  # 아이콘 생성 도구
│   └── icon*.png       # 16/48/128 아이콘
└── README.md
```

## API 연동

| 기능 | API 엔드포인트 |
|------|---------------|
| 분석 요청 | `POST /api/analysis/request` |
| 결과 조회 | `GET /api/analysis/result/[id]` |
| 사용자 확인 | `GET /api/user/profile?email=` |

## 웹스토어 배포 (추후)

1. `icons/` 폴더에 PNG 아이콘 준비
2. 확장팩 폴더를 ZIP으로 압축
3. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 에서 업로드
