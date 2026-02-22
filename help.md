# 국가/언어별 랭킹 시스템 설계
작성일: 2026-02-20 01:45

## 1. 배경 및 목표
현재 랭킹 시스템은 전체 채널을 대상으로 단일 순위를 제공하지만, 글로벌 서비스를 위해 국가/언어별로 분리된 랭킹이 필요하다. 사용자는 자신의 지역/언어 환경에 맞는 채널을 발견하고, 채널 운영자는 타겟 시장에서의 경쟁력을 파악할 수 있어야 한다.

## 2. 핵심 설계 원칙

### 2.1 랭킹 키 구조
```
[Language] + [Country] + [Category ID] + [Topic]
```

- **Language**: `t_channels.f_language` (예: 'ko', 'en', 'ja')
- **Country**: `t_channels.f_country` (예: 'KR', 'US', 'JP')
- **Category ID**: 유튜브 공식 카테고리 (1~29)
- **Topic**: `t_channel_stats.f_topic` (2단어 한국어, 예: 'AI 연구')

### 2.2 데이터 흐름
1. **영상 분석 시**: `f_language`, `f_country` 자동 감지 및 저장
2. **채널 통계 갱신**: `[Language+Country+Category+Topic]` 조합으로 그룹화
3. **랭킹 조회**: 사용자의 `navigator.language` 또는 선택 필터링

## 3. 구현 전략

### 3.1 언어/국가 감지 로직
```typescript
// 영상 메타데이터 기반 감지
const detectLanguageAndCountry = (videoInfo: VideoInfo) => {
  // 1. 언어: 자막 언어 > 제목 언어 > 기본값('en')
  // 2. 국가: 채널 국가 > 기본값('US')
  return {
    language: detectLanguage(videoInfo.title, videoInfo.description),
    country: videoInfo.country || 'US'
  };
};
```

### 3.2 랭킹 쿼리 확장
```sql
-- 기존: category_id + topic
WHERE f_category_id = $1 AND f_topic = $2

-- 확장: language + country + category_id + topic
WHERE f_language = $1 
  AND f_country = $2 
  AND f_category_id = $3 
  AND f_topic = $4
```

### 3.3 UI/UX 설계
- **자동 감지**: `navigator.language` → 'ko-KR' → language='ko', country='KR'
- **수동 선택**: 헤더에 국가/언어 선택기 추가
- **URL 구조**: `/p-ranking?topic=AI&lang=ko&country=KR`

## 4. 기술적 고려사항

### 4.1 데이터 충분성
- **문제**: 특정 조합의 채널 수가 너무 적으면 랭킹 의미 없음
- **해결**: 최소 10개 채널 미만이면 상위 레벨로 롤업
  - `ko+KR+Music+KPOP` → `ko+KR+Music` → `ko+Music` → `Music`

### 4.2 성능 최적화
- **인덱스**: `(f_language, f_country, f_category_id, f_topic, f_reliability_score)`
- **캐싱**: 각 조합별 랭킹 5분 캐시
- **CDN**: 국가별 CDN 엣지 캐시 활용

### 4.3 일관성 유지
- **기존 데이터 마이그레이션**: `language='en', country='US'`로 일괄 설정
- **신규 데이터**: 분석 시점에 자동 감지/저장
- **백필**: 주기적으로 크롤링하여 누락된 메타데이터 보완

## 5. 단계적 롤아웃 계획

### Phase 1: 데이터 수집 강화 (1주)
- [ ] `t_channels`에 `f_language`, `f_country` NOT NULL 제약조건 추가
- [ ] 신규 분석 시 언어/국가 자동 감지 로직 구현
- [ ] 기존 데이터 백필 스크립트 실행

### Phase 2: 랭킹 API 확장 (1주)
- [ ] `/api/ranking`에 language/country 파라미터 추가
- [ ] 롤업 로직 구현 (최소 채널 수 보장)
- [ ] 캐싱 전략 적용

### Phase 3: UI 개선 (1주)
- [ ] 랭킹 페이지에 국가/언어 선택기 추가
- [ ] URL 파라미터 기반 상태 유지
- [ ] 모바일 반응형 최적화

### Phase 4: 고도화 (2주)
- [ ] 지역별 트렌드 대시보드
- [ ] 크로스-언어 채널 발견 기능
- [ ] 지역별 성과 리포트

## 6. 성공 지표
- **사용자**: 지역별 랭킹 조회 수 30% 증가
- **채널**: 타겟 시장 진입 채널 수 20% 증가
- **시스템**: 랭킹 조회 응답시간 200ms 유지

---

## 🚨 긴급 수정 필요: 채널 랭킹 정렬 헤더 이모지 제거 문제
작성일: 2026-02-21 22:15

### 문제 상황
**파일**: `app/p-ranking/RankingClient.tsx` (라인 585)

**증상**:
- 로컬 개발 환경과 배포 환경 모두에서 정렬 헤더에 이모지가 여전히 표시됨
- 🔴 어그로 🔵 신뢰도 ← 이모지가 화살표를 가림
- 코드 상으로는 이모지가 제거되어 있음 (585번 라인 확인됨)

**의도한 변경**:
```typescript
// 현재 코드 (585번 라인)
{sortBy === 'reliability' ? '신뢰도' : '어그로'}

// 원하는 결과
- 이모지 완전 제거
- 어그로: 빨강색 텍스트 (text-red-500) - 핫이슈3 섹션과 동일
- 신뢰도: 초록색 텍스트 (text-green-500) - 핫이슈3 섹션과 동일
```

**현재 적용된 스타일** (580-582번 라인):
```typescript
className={`hidden md:flex items-center justify-center gap-1 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
  sortBy === 'reliability' ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'
}`}
```

### 시도한 해결 방법
1. ✅ 코드 수정 완료 (이모지 제거, 색상 클래스 추가)
2. ✅ Git 커밋 및 푸시 (커밋 d89f657, e313927)
3. ✅ 빈 커밋으로 배포 재트리거
4. ❌ 로컬/배포 환경 모두 변경사항 반영 안 됨

### 확인 사항
- `git status`: clean (변경사항 없음)
- `grep "🔴|🔵"`: 파일에서 이모지 검색 결과 없음
- 파일 내용 직접 확인: 585번 라인에 이모지 없음
- 브라우저 캐시 클리어 시도: 효과 없음

### 의심되는 원인
1. **빌드 캐시 문제**: Next.js `.next` 폴더가 이전 빌드 캐싱
2. **다른 컴포넌트**: 혹시 다른 파일에서 이 부분을 렌더링하고 있을 가능성
3. **브라우저 서비스 워커**: PWA 캐싱 문제
4. **번들러 캐시**: Webpack/Turbopack 캐시 문제

### 다음 세션 수정 방안
1. **빌드 캐시 완전 삭제**:
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run build
   ```

2. **전체 파일 검색**:
   ```bash
   grep -r "🔴" app/
   grep -r "🔵" app/
   ```

3. **RankingClient.tsx 전체 재확인**:
   - 다른 곳에서 이모지를 주입하는 로직이 있는지 확인
   - 컴포넌트 import 경로 확인

4. **개발 서버 완전 재시작**:
   - 모든 Node 프로세스 종료
   - `npm run dev` 재시작

5. **최후 수단 - 파일 재작성**:
   - 해당 라인을 완전히 다시 작성
   - 이모지 유니코드가 숨어있을 가능성 배제

### 참고: 핫이슈3 섹션 색상 (정상 작동 중)
- 어그로: `text-red-400` (app/p-plaza/page.tsx)
- 신뢰도: `text-green-400` (app/p-plaza/page.tsx)

---

*다음 세션에서 Phase 1부터 구현 시작*
