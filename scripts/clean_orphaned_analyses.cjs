const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanOrphanedAnalyses() {
  const client = await pool.connect();
  try {
    console.log('Checking for orphaned analyses...');

    // Count orphaned records (where f_channel_id is NULL or not found in t_channels)
    const countRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM t_analyses 
      WHERE f_channel_id IS NULL 
         OR f_channel_id NOT IN (SELECT f_id FROM t_channels)
    `);
    
    const count = parseInt(countRes.rows[0].count);
    console.log(`Found ${count} orphaned analysis records.`);

    if (count > 0) {
        const deleteRes = await client.query(`
          DELETE FROM t_analyses 
          WHERE f_channel_id IS NULL 
             OR f_channel_id NOT IN (SELECT f_id FROM t_channels)
        `);
        console.log(`✅ Deleted ${deleteRes.rowCount} orphaned analysis records.`);
    } else {
        console.log('No cleanup needed.');
    }

  } catch (err) {
    console.error('Error cleaning up:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanOrphanedAnalyses();
