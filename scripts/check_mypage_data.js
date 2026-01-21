
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkData() {
  const client = await pool.connect();
  try {
    console.log('--- Checking t_analyses table ---');
    const analyses = await client.query('SELECT f_id, f_video_id, f_title, f_user_id FROM t_analyses LIMIT 5');
    console.table(analyses.rows);

    console.log('\n--- Checking t_videos table ---');
    const videos = await client.query('SELECT f_video_id, f_title FROM t_videos LIMIT 5');
    console.table(videos.rows);

    console.log('\n--- Checking t_users table ---');
    const users = await client.query('SELECT f_id, f_email, f_nickname FROM t_users LIMIT 5');
    console.table(users.rows);

    const testEmail = 'jinwook.han@gmail.com'; // User's likely email based on workspace name or common patterns, but I'll check all
    
    console.log(`\n--- Testing query for email: ${testEmail} ---`);
    const refinedQuery = `
      SELECT DISTINCT ON (v.f_video_id)
        v.f_video_id as id,
        v.f_title as title,
        v.f_trust_score as score,
        v.f_created_at as created_at,
        c.f_title as channel_name
      FROM t_videos v
      LEFT JOIN t_channels c ON v.f_channel_id = c.f_channel_id
      LEFT JOIN t_analyses a ON v.f_video_id = a.f_video_id
      LEFT JOIN t_users u ON a.f_user_id = u.f_id
      WHERE u.f_email = $1
      ORDER BY v.f_video_id, v.f_created_at DESC
    `;
    const res = await client.query(refinedQuery, [testEmail]);
    console.log(`Found ${res.rows.length} videos for ${testEmail}`);
    console.table(res.rows);

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
