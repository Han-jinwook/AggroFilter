const { Pool } = require('pg');
require('dotenv').config({ path: 'd:/AggroFilter/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log("t_analysis_queue 테이블 RLS 활성화 시도 중...");
    await pool.query('ALTER TABLE public.t_analysis_queue ENABLE ROW LEVEL SECURITY;');
    console.log("✅ RLS 활성화 성공!");
  } catch (err) {
    console.error("실패:", err);
  } finally {
    await pool.end();
  }
}

run();
