const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  require('dotenv').config({ path: envLocalPath });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  statement_timeout: 60000, // 60 seconds
  query_timeout: 60000
});

async function runMigration(sqlFilePath, description) {
  const client = await pool.connect();
  try {
    console.log(`\n🔄 Running: ${description}`);
    console.log(`   File: ${path.basename(sqlFilePath)}`);
    
    // Set statement timeout to 5 minutes for this session
    await client.query("SET statement_timeout = '300000'");
    
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await client.query(sql);
    
    console.log(`✅ Success: ${description}`);
  } catch (err) {
    console.error(`❌ Failed: ${description}`);
    console.error(`   Error: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('🌍 Global Ranking System v3.1 Migration');
  console.log('========================================');
  console.log('Purpose: Language-only ranking (remove country dependency)');
  console.log('Date: 2026-02-20\n');

  try {
    // Phase 1-1: Add language to t_channels
    await runMigration(
      path.join(__dirname, '../sql/add_language_to_channels.sql'),
      'Add f_language column to t_channels'
    );

    // Phase 1-2: Add language to t_videos
    await runMigration(
      path.join(__dirname, '../sql/add_language_to_videos.sql'),
      'Add f_language columns to t_videos'
    );

    // Phase 1-3: Recreate t_rankings_cache
    await runMigration(
      path.join(__dirname, '../sql/recreate_rankings_cache.sql'),
      'Recreate t_rankings_cache with language-only schema'
    );

    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Update lib/youtube.ts for language detection');
    console.log('   2. Update app/api/analysis/request/route.ts for 3-step fallback');
    console.log('   3. Update lib/ranking_v2.ts for language-only ranking');
    console.log('   4. Run: node scripts/refresh_ranking_cache.cjs');
    
  } catch (err) {
    console.error('\n❌ Migration failed. Please fix errors and try again.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
