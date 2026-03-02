const { Pool } = require('pg');
const config = require('./src/config');

async function migrate() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Adding missing columns to t_analyses...');
    
    // Add f_not_analyzable
    try {
      await pool.query('ALTER TABLE t_analyses ADD COLUMN f_not_analyzable BOOLEAN DEFAULT FALSE');
      console.log('Added f_not_analyzable');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('f_not_analyzable already exists');
      } else {
        throw e;
      }
    }

    // Add f_not_analyzable_reason
    try {
      await pool.query('ALTER TABLE t_analyses ADD COLUMN f_not_analyzable_reason TEXT');
      console.log('Added f_not_analyzable_reason');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('f_not_analyzable_reason already exists');
      } else {
        throw e;
      }
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
