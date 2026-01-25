const { Pool } = require('pg');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses' 
      ORDER BY ordinal_position
    `);
    
    console.log('t_analyses columns:');
    res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns().catch(console.error);
