require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r1 = await pool.query("SELECT COUNT(*) as cnt FROM t_analyses WHERE f_user_id = 'bot'");
  console.log('bot rows:', r1.rows[0].cnt);

  const r2 = await pool.query("SELECT DISTINCT f_user_id FROM t_analyses ORDER BY f_user_id LIMIT 10");
  console.log('all user_ids:', r2.rows.map(r => r.f_user_id));

  const r3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='t_analyses' ORDER BY ordinal_position");
  console.log('t_analyses 컬럼:', r3.rows.map(r => r.column_name));

  const r4 = await pool.query("SELECT * FROM t_analyses WHERE f_user_id='bot' ORDER BY f_created_at DESC LIMIT 2");
  if (r4.rows.length > 0) console.log('bot 샘플:', Object.keys(r4.rows[0]));

  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
