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

  // 대시보드 포트
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3001', 10),

  // 섹션2: 댓글 자동화
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // 로컬 크롬 사용자 데이터 디렉토리 (기존 세션 재사용)
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || '',
  // 댓글 큐 딜레이 (ms): 1~2분 랜덤
  commentDelayMinMs: parseInt(process.env.COMMENT_DELAY_MIN_MS || '60000', 10),
  commentDelayMaxMs: parseInt(process.env.COMMENT_DELAY_MAX_MS || '120000', 10),
  // 유튜브 결과 페이지 URL 패턴
  resultUrlBase: (process.env.MAIN_APP_URL || 'https://aggrofilter.com') + '/result/',

  // 유튜브 공식 카테고리 전체 (한국 기준 실사용, Type2용)
  targetCategories: [
    { id: '1',  name: '필름/애니',    keyword: '영화 리뷰 최신' },
    { id: '2',  name: '자동차',       keyword: '자동차 신차 리뷰' },
    { id: '10', name: '음악',         keyword: '음악 리뷰 논평 연주' },
    { id: '15', name: '동물',         keyword: '동물 귀여운 영상' },
    { id: '17', name: '스포츠',       keyword: '스포츠 하이라이트' },
    { id: '19', name: '여행',         keyword: '여행 브이로그' },
    { id: '20', name: '게임',         keyword: '게임 플레이 최신' },
    { id: '22', name: '인물/블로그',  keyword: '브이로그 일상' },
    { id: '23', name: '코미디',       keyword: '코미디 웃긴 영상' },
    { id: '24', name: '엔터테인먼트', keyword: '예능 밈' },
    { id: '25', name: '뉴스/정치',    keyword: '뉴스 오늘' },
    { id: '26', name: '노하우/스타일',keyword: '정보 꿀팁' },
    { id: '27', name: '교육',         keyword: '투자 경제 강의' },
    { id: '28', name: '과학/기술',    keyword: 'AI 기술 최신' },
    { id: '29', name: '비영리/사회',  keyword: '사회 이슈 캠페인' },
  ],
};
