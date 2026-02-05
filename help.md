# 마케터 자동화 구축 프로젝트 가이드
작성일: 2026-02-06 03:10

## 1. 프로젝트 목표
본진(Next.js) 서비스의 안정성을 해치지 않으면서, 분석된 영상을 바탕으로 마케팅 문구(블로그, SNS 등)를 자동 생성/관리하는 시스템을 구축한다.

핵심 원칙:
- 본진에서는 마케팅/오토마케터 기능을 기본적으로 비활성화한다.
- 오토마케터는 `aggro-marketing-bot/`로 완전 분리하여 본진 빌드/배포에 간섭하지 않게 한다.
- 봇은 코어 테이블에 대해 Read-only로 접근하고, 봇 데이터는 `t_marketing_*` 테이블에만 저장한다.

## 2. 핵심 TODO 리스트

### Phase 0: 본진 안전화 (가장 우선)
- [x] **본진 오토마케터 기능 기본 OFF**: 마케팅 관련 페이지/API는 환경변수로만 ON 가능하게 가드 추가
  - `NEXT_PUBLIC_ENABLE_MARKETING_ADMIN=true` (페이지)
  - `ENABLE_MARKETING_ADMIN=true` (API)
- [ ] **본진에서 마케팅 코드 제거/이동은 보류**: 먼저 안전 가드로 사고를 막고, 이후 사용자 승인 후 `git mv`로 분리 진행

### Phase 1: `aggro-marketing-bot/` 완전 분리 프로젝트 생성
- [ ] **독립 프로젝트 폴더**: `aggro-marketing-bot/` 생성 (별도 `package.json`, 별도 `.env`)
- [ ] **빌드/배포 격리**: 본진 `npm run build`/Netlify 배포에 절대 포함되지 않도록 구성

### Phase 2: DB 스키마 (봇 전용 테이블)
- [ ] **봇 전용 테이블만 사용**: `t_marketing_*` 테이블 설계/생성
  - 예: `t_marketing_raw_videos`, `t_marketing_analysis_results`, `t_marketing_candidates`, `t_marketing_contents`
- [ ] **코어 테이블 Read-only 강제**: 가능하면 DB 계정 권한으로 차단 + 코드 레벨에서도 write 쿼리 차단

### Phase 3: 파이프라인 스크립트 구현
- [ ] **Collector**: YouTube에서 인기/이슈 영상 수집 → `t_marketing_raw_videos`
- [ ] **Analyzer**: 자막/메타 기반 분석(Gemini) → `t_marketing_analysis_results`
- [ ] **Marketer**: 후보 선별/원고 생성 → `t_marketing_candidates`, `t_marketing_contents`

### Phase 4: 대시보드(UI) (로컬 우선)
- [ ] **로컬 대시보드**: 수집/분석/후보/콘텐츠 조회 및 편집 UI
- [ ] **배포는 마지막**: 동작 검증 후 별도 배포(또는 로컬 전용 유지)

## 3. 개발 원칙 (실수 방지)
1. **단계별 PR**: 모든 기능은 작은 단위로 쪼개어 `hotfix` 브랜치가 아닌 `feature/marketer-*` 브랜치에서 작업 후 `main`으로 머지.
2. **스키마 검증**: SQL 실행 전 실제 운영 DB의 컬럼명과 타입을 반드시 대조 (to_jsonb fallback 활용 권장).
3. **환경 변수 관리**: Supabase Key 및 DATABASE_URL 설정 누락 여부 매번 확인.
4. **빌드 테스트**: 배포 전 로컬 빌드 혹은 Netlify Deploy Preview에서 모듈 참조 오류(Module not found) 확인.

---
*위 순서에 따라 Phase 0(본진 안전화)부터 진행하고, 이후 `aggro-marketing-bot/`로 완전 분리합니다.*
