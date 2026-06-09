const { Pool } = require('pg');
require('dotenv').config({ path: 'd:/AggroFilter/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query('SELECT f_video_id, f_title, f_reliability_score, f_processing_stage FROM t_analyses ORDER BY f_created_at DESC LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
