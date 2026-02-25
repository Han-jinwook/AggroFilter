const cron = require('node-cron');
const { runJob } = require('./job');
const config = require('./config');

// 설정 검증
if (!config.youtubeApiKey) {
  console.error('[Boot] 오류: YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error('[Boot] 오류: DATABASE_URL 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

console.log('========================================');
console.log('  AggroFilter AutoMarketer 시작');
console.log('  메인 앱:', config.mainAppUrl);
console.log('  분석 딜레이:', config.analysisDelayMs / 1000 + '초');
console.log('  카테고리별 최대:', config.maxVideosPerCategory + '개');
console.log('  중복 방지 기준:', config.dedupDays + '일');
console.log('  스케줄: 매일 오전 6시, 오후 6시');
console.log('========================================\n');

// 오전 6시 실행 (KST = UTC+9 → 서버 로컬타임 기준)
cron.schedule('0 6 * * *', () => {
  console.log('[Cron] 오전 6시 잡 트리거');
  runJob();
}, { timezone: 'Asia/Seoul' });

// 오후 6시 실행
cron.schedule('0 18 * * *', () => {
  console.log('[Cron] 오후 6시 잡 트리거');
  runJob();
}, { timezone: 'Asia/Seoul' });

console.log('[Boot] 스케줄러 대기 중... (종료: Ctrl+C)');
console.log('[Boot] 지금 바로 테스트하려면: node src/run-once.js\n');
