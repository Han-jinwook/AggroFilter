const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAnonymous() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT COUNT(*) FROM t_analyses WHERE f_user_id IS NULL`);
    console.log(`Anonymous Records Count: ${res.rows[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAnonymous();
