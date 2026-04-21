const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MODE = process.argv[2] || 'check'; // check | reset-oversize

(async () => {
  const client = await pool.connect();
  try {
    // 통계
    const total = await client.query('SELECT COUNT(*) as cnt FROM t_analyses WHERE f_is_valid = true');
    const hasNew = await client.query("SELECT COUNT(*) as cnt FROM t_analyses WHERE f_fact_spoiler LIKE '[{%'");
    const hasOld = await client.query("SELECT COUNT(*) as cnt FROM t_analyses WHERE f_fact_spoiler IS NOT NULL AND f_fact_spoiler NOT LIKE '[{%'");
    const hasNull = await client.query("SELECT COUNT(*) as cnt FROM t_analyses WHERE f_fact_spoiler IS NULL AND f_is_valid = true");
    
    console.log('=== 스포일러 현황 ===');
    console.log(`전체 유효 분석: ${total.rows[0].cnt}건`);
    console.log(`배열 형식 (신): ${hasNew.rows[0].cnt}건`);
    console.log(`문자열 형식 (구): ${hasOld.rows[0].cnt}건`);
    console.log(`NULL (없음): ${hasNull.rows[0].cnt}건`);

    if (MODE === 'reset-oversize') {
      // 4개 초과 항목을 가진 레코드 → NULL로 리셋 (재백필 대상)
      const oversize = await client.query(
        "SELECT f_id, f_title, f_fact_spoiler FROM t_analyses WHERE f_fact_spoiler LIKE '[{%'"
      );
      let resetCount = 0;
      for (const row of oversize.rows) {
        try {
          const arr = JSON.parse(row.f_fact_spoiler);
          if (arr.length > 4) {
            await client.query('UPDATE t_analyses SET f_fact_spoiler = NULL WHERE f_id = $1', [row.f_id]);
            console.log(`  리셋: ${row.f_title.substring(0, 50)} (${arr.length}개 → NULL)`);
            resetCount++;
          }
        } catch {}
      }
      console.log(`\n리셋 완료: ${resetCount}건`);
    } else {
      // 최근 백필 결과 확인
      const r = await client.query(
        "SELECT f_id, f_title, f_fact_spoiler FROM t_analyses WHERE f_fact_spoiler LIKE '[{%' ORDER BY f_created_at DESC LIMIT 5"
      );
      r.rows.forEach(row => {
        try {
          const s = JSON.parse(row.f_fact_spoiler);
          console.log(`\n--- ${row.f_title.substring(0, 50)} --- (${s.length}개)`);
          s.forEach((it, i) => {
            console.log(`  ${i + 1}. [topic] ${it.topic || '없음'} [ts] ${it.ts}`);
            console.log(`     ${(it.text || '').substring(0, 80)}`);
          });
        } catch {
          console.log(`\n--- ${row.f_title.substring(0, 50)} --- (파싱 실패: 구형식)`);
          console.log(`     ${row.f_fact_spoiler.substring(0, 80)}...`);
        }
      });
    }
  } finally {
    client.release();
    await pool.end();
  }
})();
