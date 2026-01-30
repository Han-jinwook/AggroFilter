
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' }); // Try .env.local first
require('dotenv').config(); // Fallback to .env

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration (f_is_latest optimization)...');
    
    await client.query('BEGIN');

    // 1. Add column if not exists
    console.log('1. Checking/Creating column f_is_latest...');
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_is_latest BOOLEAN DEFAULT FALSE
    `);

    // 2. Create Index for performance
    console.log('2. Creating index idx_analyses_is_latest...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_is_latest 
      ON t_analyses(f_is_latest) 
      WHERE f_is_latest = true
    `);

    // 3. Update existing records
    console.log('3. Updating existing records (setting f_is_latest=true for most recent ones)...');
    
    // First, reset all to false (optional but safe)
    await client.query('UPDATE t_analyses SET f_is_latest = FALSE');

    // Then set true for the latest ones
    const updateResult = await client.query(`
      WITH LatestRecords AS (
        SELECT f_id, 
               ROW_NUMBER() OVER (PARTITION BY f_video_id ORDER BY f_created_at DESC) as rn
        FROM t_analyses
        WHERE f_reliability_score IS NOT NULL
      )
      UPDATE t_analyses
      SET f_is_latest = TRUE
      WHERE f_id IN (SELECT f_id FROM LatestRecords WHERE rn = 1)
    `);
    
    console.log(`   Updated ${updateResult.rowCount} records to TRUE.`);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
