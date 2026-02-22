#!/usr/bin/env node
/**
 * f_is_latest 컬럼 현황 확인 및 수정
 * - f_is_latest가 NULL이거나 FALSE인 데이터 확인
 * - 각 video_id별 최신 분석만 TRUE로 설정
 */
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // 1. 현황 확인
    const statusRes = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE f_is_latest = TRUE) as latest_true,
        COUNT(*) FILTER (WHERE f_is_latest = FALSE) as latest_false,
        COUNT(*) FILTER (WHERE f_is_latest IS NULL) as latest_null,
        COUNT(*) as total
      FROM t_analyses
    `);
    const s = statusRes.rows[0];
    console.log('=== f_is_latest 현황 ===');
    console.log(`  TRUE:  ${s.latest_true}개`);
    console.log(`  FALSE: ${s.latest_false}개`);
    console.log(`  NULL:  ${s.latest_null}개`);
    console.log(`  전체:  ${s.total}개`);

    const needsFix = parseInt(s.latest_null) + parseInt(s.latest_false);
    if (needsFix === 0) {
      console.log('\n✅ 모든 데이터가 정상입니다.');
      return;
    }

    console.log(`\n⚠️  ${needsFix}개 레코드 수정 필요. 3초 후 자동 실행...`);
    await new Promise(r => setTimeout(r, 3000));

    // 2. 모든 레코드 FALSE로 초기화
    await client.query(`UPDATE t_analyses SET f_is_latest = FALSE WHERE f_is_latest IS NULL OR f_is_latest = FALSE`);

    // 3. 각 video_id별 최신 1개만 TRUE로 설정
    const fixRes = await client.query(`
      UPDATE t_analyses
      SET f_is_latest = TRUE
      WHERE f_id IN (
        SELECT DISTINCT ON (f_video_id) f_id
        FROM t_analyses
        ORDER BY f_video_id, f_created_at DESC
      )
      RETURNING f_id
    `);
    console.log(`✅ ${fixRes.rowCount}개 레코드를 f_is_latest = TRUE로 설정 완료`);

    // 4. 결과 재확인
    const verifyRes = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE f_is_latest = TRUE) as latest_true,
        COUNT(*) FILTER (WHERE f_is_latest IS NULL OR f_is_latest = FALSE) as not_latest,
        COUNT(*) as total
      FROM t_analyses
    `);
    const v = verifyRes.rows[0];
    console.log('\n=== 수정 후 현황 ===');
    console.log(`  최신(TRUE): ${v.latest_true}개`);
    console.log(`  이전본:     ${v.not_latest}개`);
    console.log(`  전체:       ${v.total}개`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
