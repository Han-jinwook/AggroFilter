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

async function applySecurityFix() {
  const client = await pool.connect();
  try {
    console.log('Applying RLS security fixes...');
    
    const sqlPath = path.join(__dirname, '../sql/fix_rls_security.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ RLS security fixes applied successfully.');
    
  } catch (err) {
    console.error('❌ Error applying security fix:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applySecurityFix();
