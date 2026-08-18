const { Pool } = require('pg');
require('dotenv').config({ path: 'd:/AggroFilter/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log("지나치게 관대한 t_credit_history RLS INSERT 정책 제거 시도 중...");
    await pool.query('DROP POLICY IF EXISTS "Service role can insert credit history" ON public.t_credit_history;');
    console.log("✅ RLS 정책 제거 성공!");
  } catch (err) {
    console.error("실패:", err);
  } finally {
    await pool.end();
  }
}

run();
