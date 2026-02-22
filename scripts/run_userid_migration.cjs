const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from the root directory
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Migrating f_user_id from Email to UUID...');
    
    const sqlPath = path.join(__dirname, '../sql/migrate_userid_to_uuid.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ User ID migration applied successfully.');
    
  } catch (err) {
    console.error('❌ Error applying migration:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
