import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanup() {
  try {
    const client = await pool.connect();
    try {
      // Delete topics that do not contain a space (single word topics)
      // This cleans up the legacy 1-word topics that weren't truncated
      const res = await client.query(`
        DELETE FROM t_topics_master 
        WHERE name_ko NOT LIKE '% %'
      `);
      console.log(`🧹 Cleaned up ${res.rowCount} legacy single-word topics.`);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Cleanup error:", e);
  } finally {
    await pool.end();
  }
}

cleanup();
