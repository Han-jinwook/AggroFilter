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

async function listRecent() {
  const client = await pool.connect();
  try {
    console.log('Listing ALL recent 20 analyses (No Filter)...');
    const res = await client.query(`
      SELECT f_id, f_title, f_topic, f_created_at, f_accuracy_score, f_clickbait_score
      FROM t_analyses 
      ORDER BY f_created_at DESC 
      LIMIT 20
    `);
    
    if (res.rows.length === 0) {
        console.log("No analyses found.");
    }

    res.rows.forEach(row => {
      console.log(`[${row.f_created_at.toLocaleString()}]`);
      console.log(`  ID: ${row.f_id}`);
      console.log(`  Title: ${row.f_title}`);
      console.log(`  Topic: ${row.f_topic}`);
      console.log(`  Scores: Acc(${row.f_accuracy_score}) / Clickbait(${row.f_clickbait_score})`);
      console.log('---------------------------------------------------');
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

listRecent();
