const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tablesRes.rows.map(r => r.table_name));
    
    for (const table of ['t_unclaimed_payments', 't_payment_logs']) {
      if (tablesRes.rows.some(r => r.table_name === table)) {
        const columnsRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
        console.log(`\nColumns for ${table}:`);
        console.table(columnsRes.rows);
      } else {
        console.log(`\nTable ${table} does not exist.`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
