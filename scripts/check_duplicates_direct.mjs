import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not defined");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function checkDuplicates() {
  const client = await pool.connect();
  try {
    const totalRes = await client.query('SELECT COUNT(*) FROM t_topics_master');
    const uniqueRes = await client.query('SELECT COUNT(DISTINCT embedding::text) FROM t_topics_master');
    
    const total = parseInt(totalRes.rows[0].count);
    const unique = parseInt(uniqueRes.rows[0].count);
    
    console.log(`Total Topics: ${total}`);
    console.log(`Unique Embeddings: ${unique}`);
    
    if (total === unique) {
        console.log("✅ SUCCESS: All embeddings are unique!");
    } else {
        console.log(`❌ FAILURE: Found ${total - unique} duplicates.`);
        
        // Show sample duplicates (names only)
        const dupRes = await client.query(`
            SELECT array_agg(name_ko) as names 
            FROM t_topics_master 
            GROUP BY embedding::text 
            HAVING count(*) > 1 
            LIMIT 10
        `);
        console.log("Sample Duplicates (Names):", JSON.stringify(dupRes.rows, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDuplicates();
