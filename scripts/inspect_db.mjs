import pg from 'pg';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function inspect() {
  try {
    const client = await pool.connect();
    try {
      console.log("=== 1. Table Schema: t_topics_master ===");
      const schemaRes = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 't_topics_master'
        ORDER BY ordinal_position;
      `);
      console.table(schemaRes.rows);

      console.log("\n=== 2. Sample Data (Top 5) ===");
      const dataRes = await client.query(`
        SELECT id, name_ko, substring(embedding::text, 1, 50) || '...' as embedding_preview 
        FROM t_topics_master 
        LIMIT 5;
      `);
      console.table(dataRes.rows);

      console.log("\n=== 3. Total Count ===");
      const countRes = await client.query(`SELECT COUNT(*) FROM t_topics_master`);
      console.log(`Total Records: ${countRes.rows[0].count}`);

    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Inspection error:", e);
  } finally {
    await pool.end();
  }
}

inspect();
