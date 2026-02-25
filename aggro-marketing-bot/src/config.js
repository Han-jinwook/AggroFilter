require('dotenv').config();

module.exports = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  mainAppUrl: process.env.MAIN_APP_URL || 'https://aggrofilter.com',
  botSecret: process.env.BOT_SECRET || '',
  databaseUrl: process.env.DATABASE_URL,
  analysisDelayMs: parseInt(process.env.ANALYSIS_DELAY_MS || '5000', 10),
  maxVideosPerCategory: parseInt(process.env.MAX_VIDEOS_PER_CATEGORY || '5', 10),
  dedupDays: parseInt(process.env.DEDUP_DAYS || '7', 10),

  // 한국어 트렌드 수집 대상 카테고리
  // YouTube 공식 카테고리 ID 기준
  targetCategories: [
    { id: '25', name: '뉴스/정치', keyword: '뉴스 오늘' },
    { id: '22', name: '인물/블로그', keyword: '브이로그 일상' },
    { id: '26', name: '방법/스타일', keyword: '정보 꿀팁' },
    { id: '24', name: '엔터테인먼트', keyword: '예능 밈' },
    { id: '28', name: '과학/기술', keyword: 'AI 기술 최신' },
    { id: '27', name: '교육', keyword: '투자 경제 강의' },
    { id: '17', name: '스포츠', keyword: '스포츠 하이라이트' },
  ],
};
