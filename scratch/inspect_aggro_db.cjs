const { Pool } = require('pg');
require('dotenv').config();

// Setup local postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aggrofilter'
});

async function inspectAggroDb() {
  const userId = '14789296-ecb3-46ca-94b2-b46bba06df8d';
  console.log(`🔍 Inspecting local PostgreSQL for User ID: ${userId}`);

  try {
    // 1. Analyses
    const analysesRes = await pool.query(
      'SELECT f_id, f_video_id, f_title, f_reliability_score, f_created_at, f_user_id, f_processing_stage FROM t_analyses WHERE f_user_id = $1 ORDER BY f_created_at DESC',
      [userId]
    );
    console.log(`📊 Local analyses count for user: ${analysesRes.rows.length}`);
    console.log('📊 Analyses details:', JSON.stringify(analysesRes.rows, null, 2));

    // 2. All recent analyses (to see if guest analyses exist)
    const recentRes = await pool.query(
      'SELECT f_id, f_video_id, f_title, f_reliability_score, f_created_at, f_user_id, f_processing_stage FROM t_analyses ORDER BY f_created_at DESC LIMIT 5'
    );
    console.log('📊 Recent analyses (any user):', JSON.stringify(recentRes.rows, null, 2));

  } catch (err) {
    console.error('Error querying PostgreSQL:', err.message);
  } finally {
    await pool.end();
  }
}

inspectAggroDb();
