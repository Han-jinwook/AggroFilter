# 🛠️ 어그로필터 크롬 확장팩 트러블슈팅 & 기술 명세

본 문서는 크롬 확장 프로그램의 동작 원리 및 주요 기술 이슈 대응 요령을 다룹니다.

---

## 1. 자막 추출 메커니즘 (main-world.js)

확장팩은 유튜브 플레이어 내부의 인메모리 및 네트워크 컨텍스트를 활용하여 다단계로 자막을 획득합니다:

1. **`getTranscriptParams`**: 유튜브 `/next` 응답 내 transcript params 감지.
2. **`fetchTranscript`**: WEB ➔ MWEB ➔ ANDROID 클라이언트 순차 시도.
3. **`extractCaptionTrackUrls`**: 5단계 폴백 (player API ➔ 런타임 ➔ page fetch ➔ timedtext ➔ deep search).
4. **`fetchTranscriptFromCaptionTrackFallback`**: Caption track URL 파싱 (json3 / xml / srv3 / vtt).

---

## 2. 모바일 및 일반 웹과의 협업 관계

- PC 확장팩은 **"초고속 0초 자막 제공자(Provider)"** 역할을 수행합니다.
- 확장팩이 획득한 자막(`clientTranscript`)을 백엔드에 전송하면, 백엔드는 즉시 분석을 수행하는 동시에 Supabase `t_caption_tasks` 테이블에 `f_status = 'READY'`로 적재합니다.
- 이로 인해 이후 모바일이나 확장팩 미설치 PC에서 해당 영상을 조회할 때 즉시 캐시 히트(0초)를 보장받습니다.

---

## 3. 트러블슈팅

### Q1. 영상 페이지에서 버튼이 안 보일 때
- 확장팩이 로드되어 있는지 `chrome://extensions`에서 새로고침 아이콘을 클릭합니다.
- 유튜브 페이지를 `F5`로 새로고침합니다.

### Q2. 로그인 세션 불일치 시
- 어그로필터 공식 웹사이트(`https://aggrofilter.sundreamer.app`)에 접속하여 로그인하면, 헤더 컴포넌트(`AppHeader`)가 확장팩과 세션 토큰을 자동으로 동기화합니다.

---

*Last Updated: 2026-10-01 | Merlin Family OS*
