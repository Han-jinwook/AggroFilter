
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');
    await client.query('BEGIN');

    // 1. Add f_request_count column if not exists
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_request_count INTEGER DEFAULT 1;
    `);
    console.log('Added f_request_count column');

    // 2. Add f_view_count column if not exists
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_view_count INTEGER DEFAULT 0;
    `);
    console.log('Added f_view_count column');

    // 3. Add f_last_action_at column if not exists
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_last_action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    
    // Update existing rows to have f_last_action_at = f_created_at
    await client.query(`
      UPDATE t_analyses 
      SET f_last_action_at = f_created_at 
      WHERE f_last_action_at IS NULL;
    `);
    console.log('Added and initialized f_last_action_at column');

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
