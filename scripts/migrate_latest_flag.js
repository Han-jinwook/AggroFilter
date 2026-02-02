
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');
    
    // 1. Add column if not exists
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_is_latest BOOLEAN DEFAULT TRUE
    `);
    console.log('Column f_is_latest checked/created.');

    // 2. Index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_is_latest 
      ON t_analyses(f_is_latest) 
      WHERE f_is_latest = true
    `);
    console.log('Index created.');

    // 3. Mark all as false first (optional, but safer logic below covers it)
    // Actually, simpler logic:
    // Set ALL to false, then set LATEST to true.
    // Or: Set f_is_latest = (CASE WHEN ... THEN true ELSE false END)
    
    console.log('Updating existing records...');
    
    // Using CTE to identify latest records
    const updateQuery = `
      WITH LatestRecords AS (
        SELECT f_id, 
               ROW_NUMBER() OVER (PARTITION BY f_video_id ORDER BY f_created_at DESC) as rn
        FROM t_analyses
      )
      UPDATE t_analyses
      SET f_is_latest = (
        CASE 
          WHEN f_id IN (SELECT f_id FROM LatestRecords WHERE rn = 1) THEN TRUE
          ELSE FALSE
        END
      )
    `;
    
    const res = await client.query(updateQuery);
    console.log(`Updated ${res.rowCount} records.`);
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
