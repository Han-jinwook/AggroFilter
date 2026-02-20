/**
 * Debug Script: Language Ranking Data Verification
 * 작성일: 2026-02-20 21:30
 * 
 * Purpose: 
 * - Check if t_rankings_cache has correct language separation
 * - Verify NBC News (English) and MBCNEWS (Korean) are in separate rankings
 * - Identify any language filtering issues
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function debugLanguageRanking() {
  const client = await pool.connect();
  try {
    console.log('\n=== 1. Checking t_channels language data ===');
    const channelsRes = await client.query(`
      SELECT f_channel_id, f_title, f_language
      FROM t_channels
      WHERE f_title ILIKE '%NBC%' OR f_title ILIKE '%MBC%'
      ORDER BY f_title
    `);
    console.table(channelsRes.rows);

    console.log('\n=== 2. Checking t_rankings_cache for News category ===');
    const cacheRes = await client.query(`
      SELECT 
        rc.f_channel_id,
        c.f_title,
        rc.f_language,
        rc.f_category_id,
        rc.f_ranking_key,
        rc.f_rank,
        rc.f_total_count
      FROM t_rankings_cache rc
      JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
      WHERE rc.f_category_id = 25  -- News category
      ORDER BY rc.f_language, rc.f_rank
    `);
    console.table(cacheRes.rows);

    console.log('\n=== 3. Language distribution in t_rankings_cache ===');
    const langDistRes = await client.query(`
      SELECT 
        f_language,
        COUNT(DISTINCT f_channel_id) as channel_count,
        COUNT(DISTINCT f_category_id) as category_count
      FROM t_rankings_cache
      GROUP BY f_language
      ORDER BY channel_count DESC
    `);
    console.table(langDistRes.rows);

    console.log('\n=== 4. Checking if MBCNEWS appears in English rankings ===');
    const mbcInEnglishRes = await client.query(`
      SELECT 
        rc.f_channel_id,
        c.f_title,
        c.f_language as channel_language,
        rc.f_language as cache_language,
        rc.f_ranking_key,
        rc.f_rank
      FROM t_rankings_cache rc
      JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
      WHERE rc.f_language = 'english'
        AND c.f_title ILIKE '%MBC%'
    `);
    
    if (mbcInEnglishRes.rows.length > 0) {
      console.log('⚠️  ISSUE FOUND: Korean channel in English ranking!');
      console.table(mbcInEnglishRes.rows);
    } else {
      console.log('✅ No Korean channels found in English rankings');
    }

    console.log('\n=== 5. Checking NBC News ranking ===');
    const nbcRes = await client.query(`
      SELECT 
        rc.f_channel_id,
        c.f_title,
        c.f_language,
        rc.f_ranking_key,
        rc.f_rank,
        rc.f_total_count,
        cs.f_avg_reliability
      FROM t_rankings_cache rc
      JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
      LEFT JOIN t_channel_stats cs ON rc.f_channel_id = cs.f_channel_id 
        AND cs.f_official_category_id = rc.f_category_id
      WHERE c.f_title ILIKE '%NBC%'
    `);
    console.table(nbcRes.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugLanguageRanking();
