const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from the root directory
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// Fallback to .env.local if .env doesn't exist or DATABASE_URL is missing
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

async function refreshStats() {
  const client = await pool.connect();
  try {
    console.log('Refreshing channel stats...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/populate_channel_stats.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('Channel stats refreshed successfully.');
    
    // Check count
    const res = await client.query('SELECT COUNT(*) FROM t_channel_stats');
    console.log(`Current stats count: ${res.rows[0].count}`);
    
  } catch (err) {
    console.error('Error refreshing stats:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

refreshStats();
