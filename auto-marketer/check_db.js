const { Pool } = require('pg');
const config = require('./src/config');

async function check() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query(`
      SELECT f_id, f_video_id, f_title, f_created_at, f_reliability_score, f_not_analyzable, f_not_analyzable_reason
      FROM t_analyses
      ORDER BY f_created_at DESC
      LIMIT 20
    `);
    console.log('--- Latest 20 Analyses ---');
    console.table(res.rows.map(r => ({
      id: r.f_id,
      videoId: r.f_video_id,
      title: (r.f_title || '').substring(0, 40),
      createdAt: r.f_created_at ? new Date(r.f_created_at).toLocaleString() : 'N/A',
      score: r.f_reliability_score,
      NA: r.f_not_analyzable,
      Reason: (r.f_not_analyzable_reason || '').substring(0, 30)
    })));
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
