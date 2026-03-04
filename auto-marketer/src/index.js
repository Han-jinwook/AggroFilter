const cron = require('node-cron');
const { runJob } = require('./job');
const config = require('./config');
const { startDashboard, getRuntimeOptions, setBotStatus } = require('./dashboard/server');

// 설정 검증
if (!config.youtubeApiKey) {
  console.error('[Boot] 오류: YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error('[Boot] 오류: DATABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('========================================');
console.log('  AggroFilter AutoMarketer 시작');
console.log('  메인 앱:', config.mainAppUrl);
console.log('  스케줄: 매일 00:00 / 12:00 KST');
console.log('========================================\n');

// 대시보드 서버 시작
startDashboard();

async function scheduledRun(label) {
  const opts = getRuntimeOptions();
  console.log(`[Cron] ${label} 잡 트리거 (N=${opts.trackNTotal}, M=${opts.trackMPerCategory}, X=${opts.dedupDays}일)`);
  setBotStatus({ running: true });
  try {
    const result = await runJob(opts);
    setBotStatus({ running: false, lastRun: new Date().toISOString(), lastResult: result });
  } catch (e) {
    setBotStatus({ running: false, lastRun: new Date().toISOString(), lastResult: { error: e.message } });
  }
}

// 자정 00:00 (KST)
cron.schedule('0 0 * * *', () => scheduledRun('자정 00:00'), { timezone: 'Asia/Seoul' });

// 정오 12:00 (KST)
cron.schedule('0 12 * * *', () => scheduledRun('정오 12:00'), { timezone: 'Asia/Seoul' });

console.log('[Boot] 스케줄러 대기 중... (종료: Ctrl+C)');
console.log(`[Boot] 대시보드: http://localhost:${config.dashboardPort}\n`);
