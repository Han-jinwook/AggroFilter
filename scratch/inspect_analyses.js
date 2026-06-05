const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      databaseUrl = match[1].trim();
      break;
    }
  }
}

databaseUrl = databaseUrl.split('#')[0].trim();

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT f_id, f_title, f_channel_id, f_accuracy_score, f_clickbait_score, f_reliability_score 
      FROM t_analyses 
      ORDER BY f_created_at DESC 
      LIMIT 5
    `);
    console.log('Latest analyses:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
