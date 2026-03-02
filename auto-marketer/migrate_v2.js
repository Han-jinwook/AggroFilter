const { Pool } = require('pg');
const config = require('./src/config');

async function migrate() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Migrating t_analyses table...');
    
    await pool.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_is_valid BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS f_needs_review BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS f_review_reason TEXT
    `);
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
