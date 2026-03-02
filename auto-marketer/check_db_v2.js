const { Pool } = require('pg');
const config = require('./src/config');

async function checkColumns() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses'
      ORDER BY ordinal_position
    `);
    console.log('Columns in t_analyses:');
    console.log(colRes.rows.map(r => r.column_name).join(', '));

    const statusRes = await pool.query(`
      SELECT f_id, f_video_id, f_title, f_created_at, f_reliability_score, f_is_latest, f_language, f_not_analyzable
      FROM t_analyses
      ORDER BY f_created_at DESC
      LIMIT 30
    `);
    console.log('--- Latest 30 Analyses Status ---');
    console.table(statusRes.rows.map(r => ({
      title: (r.f_title || '').substring(0, 40),
      score: r.f_reliability_score,
      latest: r.f_is_latest,
      lang: r.f_language,
      NA: r.f_not_analyzable,
      time: r.f_created_at ? new Date(r.f_created_at).toLocaleString() : 'N/A'
    })));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
