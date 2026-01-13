const { Pool } = require('pg');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const VIDEO_ID = 'XrU3xWoMuWE'; // The test video ID

async function clean() {
  const client = await pool.connect();
  try {
    console.log(`Checking for analysis of video: ${VIDEO_ID}`);
    const res = await client.query('SELECT f_id, f_topic FROM t_analyses WHERE f_video_id = $1', [VIDEO_ID]);
    
    if (res.rows.length > 0) {
      console.log(`Found ${res.rows.length} records.`);
      for (const row of res.rows) {
        console.log(`Deleting ID: ${row.f_id}, Topic: ${row.f_topic}`);
        await client.query('DELETE FROM t_analyses WHERE f_id = $1', [row.f_id]);
        
        // Also clean stats if needed, but for now just analysis is enough to trigger re-analysis
        if (row.f_topic) {
             await client.query('DELETE FROM t_channel_stats WHERE f_topic = $1', [row.f_topic]);
        }
      }
      console.log('Cleanup complete.');
    } else {
      console.log('No records found.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

clean();
