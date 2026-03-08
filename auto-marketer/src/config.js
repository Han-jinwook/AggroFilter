require('dotenv').config();

module.exports = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  mainAppUrl: process.env.MAIN_APP_URL || 'https://aggrofilter.com',
  botSecret: process.env.BOT_SECRET || '',
  databaseUrl: process.env.DATABASE_URL,
  analysisDelayMs: parseInt(process.env.ANALYSIS_DELAY_MS || '5000', 10),

  // 2-Track 수집 옵션 (대시보드에서 런타임에 덮어씌울 수 있음)
  // N: Type1 전체 트렌드 상위 수집 개수
  trackNTotal: parseInt(process.env.TRACK_N_TOTAL || '10', 10),
  // M: Type2 카테고리별 수집 개수
  trackMPerCategory: parseInt(process.env.TRACK_M_PER_CATEGORY || '3', 10),
  // X: 채널 다양성 쿨타임 (일) - 최근 X일 이내 분석된 채널 스킵
  dedupDays: parseInt(process.env.DEDUP_DAYS || '7', 10),
  // Type1 동일 채널 최대 허용 수 (N개 중 동일 채널은 최대 이 수만큼)
  maxPerChannel: parseInt(process.env.MAX_PER_CHANNEL || '2', 10),
  // 최소 조회수 하한 (이 수치 미만 영상은 수집 제외)
  minViewCount: parseInt(process.env.MIN_VIEW_COUNT || '1000', 10),
  // 최소 시간당 조회수(VPH) 하한 - 하꼬 영상 원천 차단
  minViewsPerHour: parseInt(process.env.MIN_VIEWS_PER_HOUR || '500', 10),

  // 대시보드 포트
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3001', 10),

  // ── 섹션2: 어그로 키워드 사냥 (Type3) ──
  // K: 키워드당 검색 개수
  aggroSearchPerKeyword: parseInt(process.env.AGGRO_SEARCH_PER_KEYWORD || '30', 10),
  // 오픈소스 AI 사전필터 컷라인 (이 점수 이상만 유료 분석)
  aggroPreScoreCutoff: parseInt(process.env.AGGRO_PRESCORE_CUTOFF || '60', 10),
  // 유료 분석 일일 한도
  aggroDailyAnalysisLimit: parseInt(process.env.AGGRO_DAILY_ANALYSIS_LIMIT || '30', 10),
  // Ollama 엔드포인트 (로컬)
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  // Ollama 모델명
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',

  // 초기 시드 키워드 (DB 없을 때 폴백 — 실제 운영은 DB bot_aggro_keywords에서 관리)
  defaultAggroKeywordGroups: [
    {
      groupName: '일반/이슈/렉카',
      keywords: ['단독', '충격', '폭로', '경악', '논란', '소름', '근황', '결말', '진실', '숨겨진', '참교육', '분노'],
    },
    {
      groupName: '금전손해/사기/코인',
      keywords: ['폭락', '상폐', '먹튀', '전재산', '청산', '세력', '급등', '떡상', '사기', '피해자', '원금보장', '무조건', '폰지'],
    },
  ],

  // ── 섹션2 기존: 댓글 자동화 ──
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // 로컬 크롬 사용자 데이터 디렉토리 (기존 세션 재사용)
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || '',
  // 댓글 큐 딜레이 (ms): 1~2분 랜덤
  commentDelayMinMs: parseInt(process.env.COMMENT_DELAY_MIN_MS || '60000', 10),
  commentDelayMaxMs: parseInt(process.env.COMMENT_DELAY_MAX_MS || '120000', 10),
  // 유튜브 결과 페이지 URL 패턴
  resultUrlBase: (process.env.MAIN_APP_URL || 'https://aggrofilter.com') + '/result/',

  // 수집 화이트리스트 (7개 핵심 카테고리)
  targetCategories: [
    { id: '22', name: '인물/블로그',  keyword: '인물 인터뷰 브이로그 이슈' },
    { id: '24', name: '엔터테인먼트', keyword: '예능 방송 연예 이슈' },
    { id: '25', name: '뉴스/정치',    keyword: '뉴스 분석 논평 이슈 사건' },
    { id: '26', name: '노하우/스타일',keyword: '꿀팁 정보 생활 지식' },
    { id: '27', name: '교육',         keyword: '강의 교육 지식 정보' },
    { id: '28', name: '과학/기술',    keyword: '과학 기술 IT 분석 리뷰' },
    { id: '29', name: '비영리/사회',  keyword: '사회 이슈 운동 분석' },
  ],
  // [참고] 수집기는 화이트리스트 방식으로 동작 (targetCategories에 없는 카테고리는 전부 자동 차단)
  // 본진 앱(route.ts)은 블랙리스트 방식으로 명시적 차단: 1,2,10,15,17,19,20,23,43(Shows)
};
