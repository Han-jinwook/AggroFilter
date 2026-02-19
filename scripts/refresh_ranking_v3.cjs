const { Pool } = require('pg');
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
  }
});

async function refreshRanking() {
  const client = await pool.connect();
  try {
    console.log('🌍 Refreshing Global Ranking v3.1 (Language-Only)...\n');
    
    // Import refreshRankingCache function
    const { refreshRankingCache } = require('../lib/ranking_v2.ts');
    
    await refreshRankingCache();
    
    console.log('\n✅ Ranking cache refreshed successfully!');
    
    // Check results
    const res = await client.query(`
      SELECT 
        f_language,
        f_category_id,
        COUNT(*) as channel_count
      FROM t_rankings_cache
      GROUP BY f_language, f_category_id
      ORDER BY f_language, f_category_id
    `);
    
    console.log('\n📊 Ranking Cache Summary:');
    console.log('Language | Category | Channels');
    console.log('---------|----------|----------');
    res.rows.forEach(row => {
      console.log(`${row.f_language.padEnd(8)} | ${String(row.f_category_id).padEnd(8)} | ${row.channel_count}`);
    });
    
  } catch (err) {
    console.error('❌ Error refreshing ranking:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

refreshRanking();
