require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function inspectVids() {
  const MERLIN_STARK_ID = '5ea629a5-574b-4529-b0c4-22535e391c94';
  const { rows } = await pgPool.query(`
    SELECT f_id, f_created_at
    FROM t_analyses
    WHERE f_user_id = $1
    ORDER BY f_created_at ASC
  `, [MERLIN_STARK_ID]);

  console.log(`Total videos for MerlinStark: ${rows.length}`);
  const beforeMay16 = rows.filter(r => new Date(r.f_created_at) < new Date('2026-05-16T00:00:00Z'));
  const afterMay16 = rows.filter(r => new Date(r.f_created_at) >= new Date('2026-05-16T00:00:00Z'));
  console.log(`Before May 16: ${beforeMay16.length}`);
  console.log(`After May 16: ${afterMay16.length}`);
  pgPool.end();
}

inspectVids().catch(e => {
  console.error(e);
  pgPool.end();
});
