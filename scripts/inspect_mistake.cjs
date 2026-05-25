require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pgPool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  console.log("=== 1. Checking t_prediction_quiz ===");
  try {
    const { rows: quizCount } = await pgPool.query(`SELECT COUNT(*) FROM t_prediction_quiz`);
    console.log(`t_prediction_quiz table still exists and has ${quizCount[0].count} rows.`);
    const { rows: oldest } = await pgPool.query(`SELECT created_at FROM t_prediction_quiz ORDER BY created_at ASC LIMIT 1`);
    const { rows: newest } = await pgPool.query(`SELECT created_at FROM t_prediction_quiz ORDER BY created_at DESC LIMIT 1`);
    console.log(`Quiz rows date range: ${oldest[0]?.created_at} to ${newest[0]?.created_at}`);
  } catch (err) {
    console.log("Error or table doesn't exist:", err.message);
  }

  console.log("\n=== 2. Checking t_analyses for MerlinStark ===");
  try {
    const MERLIN_STARK_ID = '5ea629a5-574b-4529-b0c4-22535e391c94';
    const { rows: vids } = await pgPool.query(`SELECT COUNT(*) FROM t_analyses WHERE f_user_id = $1`, [MERLIN_STARK_ID]);
    console.log(`Videos currently owned by MerlinStark (${MERLIN_STARK_ID}): ${vids[0].count}`);
  } catch(e) {}

  pgPool.end();
}

inspect().catch(e => {
  console.error(e);
  pgPool.end();
});
