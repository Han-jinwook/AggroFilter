/**
 * 즉시 1회 실행용 스크립트
 * 사용: node src/run-once.js
 */
const { runJob } = require('./job');
const config = require('./config');

if (!config.youtubeApiKey) {
  console.error('[run-once] 오류: YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error('[run-once] 오류: DATABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('[run-once] 즉시 실행 모드 시작\n');
runJob().then(() => {
  console.log('[run-once] 완료. 프로세스 종료.');
  process.exit(0);
}).catch((err) => {
  console.error('[run-once] 오류:', err);
  process.exit(1);
});
