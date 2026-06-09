const { Pool } = require('pg');
require('dotenv').config({ path: 'd:/AggroFilter/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const analysisId = 'ec96dd06-c94b-4ded-b0fe-b36937771123';
  try {
    const res = await pool.query(`
      SELECT f_video_id, f_title, f_accuracy_score, f_clickbait_score, f_reliability_score, 
             f_grounding_used, f_grounding_queries, f_evaluation_reason, f_fact_spoiler 
      FROM t_analyses 
      WHERE f_id = $1
    `, [analysisId]);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
