# 📋 어그로필터 TODO 리스트 (시스템 정돈)

본 문서는 불필요한 레거시 제거 및 시스템 고도화 작업을 관리합니다.

---

## 🧹 등급 로드맵 및 예측 퀴즈 제거 (진행 중)

> **배경**: 대기 제로 전략 도입으로 인해, 영상 분석 전 예측 퀴즈 및 그에 따른 등급 시스템(오라클, 호구 등)이 불필요해짐. (채널 신뢰도 등급 R/Y/G는 유지)

### 1단계: UI 은닉 및 로직 주석화 (2026-05-15) - [완료]
- [x] `app/p-settings/page.tsx`: 설정 페이지 왼쪽 '등급 로드맵' UI 제거 및 프로필 중앙 정렬.
- [x] `app/p-settings/page.tsx`: 예측 통계 API(`/api/prediction/stats`) 호출 주석 처리.
- [x] `app/p-result/c-result/score-card.tsx`: 결과 카드 내 '나의 신뢰도 촉' UI 주석 처리.
- [x] `app/p-result/ResultClient.tsx`: 퀴즈 결과 로딩 및 서버 제출 로직 주석 처리.
- [ ] `app/c-home/gamified-loading-quiz.tsx`: 호출부(은신처) 확인 후 제거 필요. (현재 검색되지 않음)

### 2단계: 모니터링 및 간 보기 (진행 예정)
- [ ] 3~7일간 시스템 에러 여부 확인 (특히 유저 프로필 조회 및 데이터 병합 시).
- [ ] `predictionStats` 관련 상태값이 없어도 UI 레이아웃이 깨지지 않는지 확인.

### 3단계: 완전 도려내기 (완전 제거)
- [ ] `app/p-settings/c-tier-roadmap.tsx` 파일 삭제.
- [ ] `lib/prediction-grading.ts` 파일 삭제.
- [ ] `app/api/prediction/` 폴더 내 API 라우트 삭제.
- [ ] DB(`t_users`) 내 관련 필드(`avg_gap`, `total_predictions`, `current_tier`) 정리 검토.

---
> "안전하게 주석 처리 후, 확신이 들 때 완전히 제거한다." - Merlin 강령
