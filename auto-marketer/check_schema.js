const { Pool } = require('pg');
const config = require('./src/config');

async function checkSchema() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses'
      ORDER BY ordinal_position
    `);
    console.log('Columns in t_analyses:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
  } catch (err) {
    console.error('Error checking schema:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
