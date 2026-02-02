
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not defined.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function refreshStats() {
  const client = await pool.connect();
  try {
    console.log('Starting t_channel_stats refresh based on f_is_latest=TRUE...');
    
    await client.query('BEGIN');

    // 1. Clear existing stats (optional, or use upsert. Truncate is cleaner if we rebuild all)
    // But to be safe, let's use UPSERT logic or Delete all and Insert.
    // Let's DELETE ALL first to remove stale entries that might have 0 valid videos now.
    console.log('1. Clearing old stats...');
    await client.query('TRUNCATE TABLE t_channel_stats');

    // 2. Insert fresh stats derived ONLY from latest analyses
    console.log('2. Calculating and inserting new stats...');
    const insertQuery = `
      INSERT INTO t_channel_stats (
        f_channel_id, 
        f_official_category_id, 
        f_video_count, 
        f_avg_accuracy, 
        f_avg_clickbait, 
        f_avg_reliability, 
        f_last_updated
      )
      SELECT 
        f_channel_id, 
        f_official_category_id,
        COUNT(*)::integer as video_count, 
        ROUND(AVG(f_accuracy_score), 2) as avg_accuracy, 
        ROUND(AVG(f_clickbait_score), 2) as avg_clickbait, 
        ROUND(AVG(f_reliability_score), 2) as avg_reliability,
        NOW()
      FROM t_analyses
      WHERE f_is_latest = TRUE
        AND f_reliability_score IS NOT NULL
      GROUP BY f_channel_id, f_official_category_id
    `;
    
    const res = await client.query(insertQuery);
    console.log(`   Inserted stats for ${res.rowCount} channel-category pairs.`);

    await client.query('COMMIT');
    console.log('Stats refresh completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stats refresh failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

refreshStats();
