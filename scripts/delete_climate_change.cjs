const { Pool } = require('pg');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  require('dotenv').config({ path: envLocalPath });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteClimateChange() {
  const client = await pool.connect();
  try {
    console.log('Searching for analysis with topic "Climate Change" (기후 변화)...');
    
    const res = await client.query(`
      SELECT f_id, f_title, f_topic, f_channel_id, f_created_at 
      FROM t_analyses 
      WHERE f_topic IN ('기후 변화', '기후변화')
      ORDER BY f_created_at DESC 
      LIMIT 1
    `);

    if (res.rows.length > 0) {
      const target = res.rows[0];
      console.log(`Found target analysis:`);
      console.log(`- ID: ${target.f_id}`);
      console.log(`- Title: ${target.f_title}`);
      console.log(`- Topic: ${target.f_topic}`);

      await client.query('BEGIN');
      await client.query(`DELETE FROM t_analyses WHERE f_id = $1`, [target.f_id]);
      await client.query(`
          DELETE FROM t_channel_stats 
          WHERE f_channel_id = $1 AND f_topic = $2
      `, [target.f_channel_id, target.f_topic]);
      // Also clean up from master if it's there
      await client.query(`DELETE FROM t_topics_master WHERE name_ko = $1`, [target.f_topic]);
      
      await client.query('COMMIT');
      console.log('✅ Successfully deleted the "Climate Change" analysis.');
    } else {
      console.log('No analysis with topic "기후 변화" found.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

deleteClimateChange();
