const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env file manually
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

if (!databaseUrl) {
  console.error('Error: DATABASE_URL not found in environment or .env file');
  process.exit(1);
}

// Strip any inline comments from DATABASE_URL if present
databaseUrl = databaseUrl.split('#')[0].trim();

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false }
});

async function run() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'drop_social_and_prediction_20260530.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Running DDL script to drop social and prediction elements...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Successfully dropped all social, comment, and prediction tables/columns!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
