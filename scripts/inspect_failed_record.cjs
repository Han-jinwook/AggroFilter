const { Pool } = require('pg');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ID = '5daa91e6-8eca-4f13-ba43-a0204e3eb91a';

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM t_analyses WHERE f_id = $1', [ID]);
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log('Record not found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
