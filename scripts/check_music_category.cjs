const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkMusicCategory() {
  const client = await pool.connect();
  try {
    console.log('🎵 Checking Music Category (ID: 10)...\n');

    // Check t_channel_stats
    const statsRes = await client.query(`
      SELECT 
        cs.f_channel_id, 
        c.f_title, 
        cs.f_official_category_id, 
        c.f_language, 
        cs.f_avg_reliability, 
        cs.f_video_count
      FROM t_channel_stats cs
      JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
      WHERE cs.f_official_category_id = 10
      ORDER BY cs.f_avg_reliability DESC
    `);

    console.log(`Found ${statsRes.rows.length} channels in t_channel_stats with category 10:`);
    console.table(statsRes.rows);

    // Check t_rankings_cache
    const cacheRes = await client.query(`
      SELECT 
        rc.f_channel_id,
        c.f_title,
        rc.f_language,
        rc.f_category_id,
        rc.f_ranking_key,
        rc.f_rank
      FROM t_rankings_cache rc
      JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
      WHERE rc.f_category_id = 10
      ORDER BY rc.f_rank
    `);

    console.log(`\nFound ${cacheRes.rows.length} channels in t_rankings_cache with category 10:`);
    console.table(cacheRes.rows);

    // Check recent analyses with category 10
    const analysesRes = await client.query(`
      SELECT 
        a.f_id,
        a.f_title,
        a.f_channel_id,
        c.f_title as channel_name,
        a.f_official_category_id,
        c.f_language,
        a.f_created_at
      FROM t_analyses a
      JOIN t_channels c ON a.f_channel_id = c.f_channel_id
      WHERE a.f_official_category_id = 10
      ORDER BY a.f_created_at DESC
      LIMIT 5
    `);

    console.log(`\nRecent analyses with category 10:`);
    console.table(analysesRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

checkMusicCategory().catch(console.error);
