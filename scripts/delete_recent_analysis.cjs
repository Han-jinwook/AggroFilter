const { Pool } = require('pg');
const path = require('path');

// Load .env from the root directory
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// Fallback to .env.local
if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  require('dotenv').config({ path: envLocalPath });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function deleteRecentBadAnalysis() {
  const client = await pool.connect();
  try {
    console.log('Searching for ANY analysis with topic "Earth Science" (지구 과학)...');
    
    // 조회 (기간 제한 없이 지구 과학 주제 검색)
    const res = await client.query(`
      SELECT f_id, f_title, f_topic, f_channel_id, f_created_at 
      FROM t_analyses 
      WHERE f_topic = '지구 과학'
      ORDER BY f_created_at DESC 
      LIMIT 1
    `);

    if (res.rows.length > 0) {
      const target = res.rows[0];
      console.log(`Found target analysis:`);
      console.log(`- ID: ${target.f_id}`);
      console.log(`- Title: ${target.f_title}`);
      console.log(`- Topic: ${target.f_topic}`);
      console.log(`- Created At: ${target.f_created_at}`);

      // 삭제 실행
      await client.query('BEGIN');
      
      // 1. t_analyses 삭제
      await client.query(`DELETE FROM t_analyses WHERE f_id = $1`, [target.f_id]);
      console.log(`Deleted analysis record (ID: ${target.f_id})`);
      
      // 2. t_channel_stats 삭제
      const statsRes = await client.query(`
          DELETE FROM t_channel_stats 
          WHERE f_channel_id = $1 AND f_topic = $2
      `, [target.f_channel_id, target.f_topic]);
      console.log(`Deleted channel stats for topic "${target.f_topic}"`);
      
      await client.query('COMMIT');
      console.log('✅ Successfully deleted the analysis and stats.');
    } else {
      console.log('No analysis with topic "지구 과학" found.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting analysis:', err);
  } finally {
    client.release();
    pool.end();
  }
}

deleteRecentBadAnalysis();
