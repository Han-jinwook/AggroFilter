const fs = require('fs');
const { Pool } = require('pg');

async function runMigration() {
  try {
    const envPath = 'd:/AggroFilter/.env';
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found at ' + envPath);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
    
    if (!dbUrlLine) {
      throw new Error('DATABASE_URL not found in .env');
    }

    const dbUrl = dbUrlLine.split('=')[1].trim().replace(/^["']|["']$/g, '');
    
    const pool = new Pool({ connectionString: dbUrl });
    
    console.log('Starting DB migration...');
    const sql = `
      ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_language VARCHAR(10) DEFAULT 'ko';
      ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_country VARCHAR(10) DEFAULT 'KR';
      CREATE INDEX IF NOT EXISTS idx_channels_lang_country_cat ON t_channels (f_language, f_country, f_official_category_id);
    `;
    
    await pool.query(sql);
    console.log('DB Update Success');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('DB Update Failed:', err.message);
    process.exit(1);
  }
}

runMigration();
