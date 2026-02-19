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

*다음 세션에서 Phase 1부터 구현 시작*
