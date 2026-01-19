
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetData() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Data Reset (V2.0 Prep) ---');
    await client.query('BEGIN');

    // 1. 기존 분석 데이터 및 통계 삭제
    console.log('Cleaning up t_analyses, t_videos, t_channel_stats...');
    await client.query('DELETE FROM t_analyses');
    await client.query('DELETE FROM t_videos');
    await client.query('DELETE FROM t_channel_stats');
    await client.query('DELETE FROM t_rankings_cache');

    // 2. 마스터 주제 테이블 삭제 (요청사항)
    console.log('Cleaning up t_topics_master...');
    await client.query('DELETE FROM t_topics_master');

    await client.query('COMMIT');
    console.log('--- Data Reset Successful ---');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('--- Data Reset Failed ---', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resetData();
