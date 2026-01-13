const { Pool } = require('pg');
const path = require('path');

// Load .env
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  require('dotenv').config({ path: envLocalPath });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanMasterAndVerify() {
  const client = await pool.connect();
  try {
    console.log('--- Cleaning Up "토목 공학" ---');

    // 1. Check t_analyses for any remaining records
    const analyses = await client.query(`
      SELECT f_id, f_title, f_topic 
      FROM t_analyses 
      WHERE f_topic IN ('토목 공학', '토목공학')
    `);
    
    if (analyses.rows.length > 0) {
        console.log(`Found ${analyses.rows.length} remaining analyses with topic '토목 공학'. Deleting...`);
        for (const row of analyses.rows) {
            await client.query('DELETE FROM t_analyses WHERE f_id = $1', [row.f_id]);
            console.log(`Deleted analysis: ${row.f_title} (${row.f_id})`);
        }
    } else {
        console.log("No analyses found in t_analyses with topic '토목 공학'.");
    }

    // 2. Check t_channel_stats
    const stats = await client.query(`
        DELETE FROM t_channel_stats 
        WHERE f_topic IN ('토목 공학', '토목공학')
        RETURNING *
    `);
    if (stats.rowCount > 0) {
        console.log(`Deleted ${stats.rowCount} stats records for topic '토목 공학'.`);
    } else {
        console.log("No stats found in t_channel_stats for topic '토목 공학'.");
    }

    // 3. Check t_topics_master
    const master = await client.query(`
        DELETE FROM t_topics_master 
        WHERE name_ko IN ('토목 공학', '토목공학')
        RETURNING *
    `);
    if (master.rowCount > 0) {
        console.log(`Deleted ${master.rowCount} topic records from t_topics_master.`);
    } else {
        console.log("No topic found in t_topics_master for '토목 공학'.");
    }

    console.log('--- Cleanup Complete ---');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

cleanMasterAndVerify();
