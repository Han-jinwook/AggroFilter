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

---

## 해결 완료 (2026-02-14 01:10)

### 댓글/답글 프로필 이미지 새로고침 후 사라지는 문제 ✅

**근본 원인 (2단계):**
1. **1차 원인**: 프로필 이미지가 `localStorage`에만 저장되고 DB(`t_users.f_image`)에는 저장되지 않음
2. **2차 원인 (핵심)**: `t_analyses.f_user_id`가 `NULL`로 저장되어 댓글 조회 시 `t_users`와 JOIN 불가
   - 며칠 전부터 분석 요청 시 로그인하지 않은 상태로 진행되어 `f_user_id`가 `NULL`로 저장됨
   - `app/api/analysis/request/route.ts:395`에서 `actualUserId`가 `null`이면 그대로 저장됨

**해결 방법:**

**Phase 1: 프로필 이미지 DB 저장 로직 구현 ✅**
1. ✅ **프로필 업데이트 API 생성**: `/api/user/profile` (PUT/GET)
2. ✅ **설정 페이지 수정**: `app/p-settings/page.tsx`
3. ✅ **로그인 로직 수정**: `app/page.tsx`, `app/p-result/ResultClient.tsx`
4. ✅ **사용자 생성 로직 수정**: `app/api/comments/route.ts`, `app/api/analysis/request/route.ts`

**Phase 2: 기존 NULL 데이터 일괄 수정 ⏳**
1. ✅ **SQL 파일 생성**: `scripts/fix_null_user_ids.sql`
2. ⏳ **Supabase Dashboard에서 실행 필요**:
   ```sql
   UPDATE t_analyses 
   SET f_user_id = 'chiu3@naver.com' 
   WHERE f_user_id IS NULL;
   ```

**다음 단계:**
1. Supabase Dashboard > SQL Editor에서 `scripts/fix_null_user_ids.sql` 실행
2. 댓글 작성 후 새로고침하여 프로필 이미지 유지 확인

**완료된 기능:**
- ✅ 댓글/답글 좋아요/싫어요 기능
- ✅ 댓글/답글 수정 기능 (UI)
- ✅ 댓글/답글 삭제 기능 (DB 연동)
- ✅ '어그로필터 AI분석 결과' 제목 파란색 표시
- ✅ 댓글 입력창 프로필 크기 조정 (30px)
