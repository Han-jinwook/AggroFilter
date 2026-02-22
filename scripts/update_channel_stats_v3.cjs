const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function updateChannelStats() {
  const client = await pool.connect();
  try {
    console.log('🔄 Updating channel stats (v3.3 schema)...\n');

    await client.query('BEGIN');

    // Delete and regenerate t_channel_stats
    const deleteRes = await client.query('DELETE FROM t_channel_stats');
    console.log(`Deleted ${deleteRes.rowCount} old stats\n`);

    const insertQuery = `
      INSERT INTO t_channel_stats (
        f_channel_id,
        f_official_category_id,
        f_language,
        f_video_count,
        f_avg_accuracy,
        f_avg_clickbait,
        f_avg_reliability,
        f_last_updated
      )
      WITH LatestAnalyses AS (
        SELECT DISTINCT ON (f_video_id)
          f_channel_id,
          f_official_category_id,
          f_accuracy_score,
          f_clickbait_score,
          f_reliability_score,
          f_created_at
        FROM t_analyses
        WHERE f_is_latest = TRUE
          AND f_channel_id IS NOT NULL
          AND f_official_category_id IS NOT NULL
        ORDER BY f_video_id, f_created_at DESC
      )
      SELECT 
        la.f_channel_id,
        la.f_official_category_id,
        COALESCE(c.f_language, 'korean') as language,
        COUNT(*)::int as video_count,
        ROUND(AVG(la.f_accuracy_score), 2) as avg_accuracy,
        ROUND(AVG(la.f_clickbait_score), 2) as avg_clickbait,
        ROUND(AVG(la.f_reliability_score), 2) as avg_reliability,
        NOW() as last_updated
      FROM LatestAnalyses la
      JOIN t_channels c ON la.f_channel_id = c.f_channel_id
      GROUP BY la.f_channel_id, la.f_official_category_id, c.f_language
      HAVING COUNT(*) >= 1
    `;

    const insertRes = await client.query(insertQuery);
    console.log(`Inserted ${insertRes.rowCount} channel stats\n`);

    await client.query('COMMIT');

    // Verify
    const verifyRes = await client.query(`
      SELECT 
        cs.f_channel_id,
        c.f_title,
        cs.f_official_category_id,
        c.f_language,
        cs.f_video_count,
        cs.f_avg_reliability
      FROM t_channel_stats cs
      JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
      WHERE cs.f_official_category_id = 10
      ORDER BY cs.f_avg_reliability DESC
    `);

    console.log('Music category (10) stats:');
    console.table(verifyRes.rows);

    console.log('\n✅ Channel stats updated successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateChannelStats().catch(console.error);
