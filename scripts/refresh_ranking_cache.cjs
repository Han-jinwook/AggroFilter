/**
 * Refresh Ranking Cache Script
 * 작성일: 2026-02-20 21:30
 * 
 * Purpose: Regenerate t_rankings_cache with proper language separation
 * This ensures Korean and English channels are ranked separately
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function refreshRankingCache() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting ranking cache refresh...\n');

    await client.query('BEGIN');

    // 1. Clear existing cache
    console.log('1️⃣  Clearing existing cache...');
    const deleteRes = await client.query('DELETE FROM t_rankings_cache');
    console.log(`   Deleted ${deleteRes.rowCount} rows\n`);

    // 2. Regenerate cache with language-based ranking
    console.log('2️⃣  Regenerating cache with language separation (v3.3)...');
    const insertQuery = `
      INSERT INTO t_rankings_cache (
        f_channel_id, f_category_id, f_language, f_ranking_key, f_rank, f_total_count, f_top_percentile
      )
      WITH ChannelStats AS (
        SELECT 
          f_channel_id,
          f_official_category_id as category_id,
          COALESCE(f_language, 'korean') as language,
          COALESCE(f_language, 'korean') || '_' || f_official_category_id::text as ranking_key,
          f_avg_reliability as avg_score,
          f_video_count as video_count
        FROM t_channel_stats
        WHERE f_avg_reliability IS NOT NULL
          AND f_official_category_id IS NOT NULL
      ),
      RankedChannels AS (
        SELECT 
          f_channel_id,
          category_id,
          language,
          ranking_key,
          RANK() OVER(PARTITION BY ranking_key ORDER BY avg_score DESC) as rank_num,
          COUNT(*) OVER(PARTITION BY ranking_key) as total_in_key
        FROM ChannelStats
        WHERE video_count >= 1
      )
      SELECT 
        f_channel_id,
        category_id,
        language,
        ranking_key,
        rank_num,
        total_in_key,
        ROUND((rank_num::decimal / total_in_key::decimal) * 100, 2) as top_percentile
      FROM RankedChannels
    `;

    const insertRes = await client.query(insertQuery);
    console.log(`   Inserted ${insertRes.rowCount} ranking entries\n`);

    // 3. Update t_channels basic stats (score, grade, count)
    console.log('3️⃣  Syncing t_channels basic stats...');
    const syncChannelsQuery = `
      UPDATE t_channels c
      SET 
        f_trust_score = sub.avg_score,
        f_video_count = sub.video_count,
        f_trust_grade = CASE 
          WHEN sub.avg_score >= 70 THEN 'green'
          WHEN sub.avg_score >= 50 THEN 'yellow'
          ELSE 'red'
        END
      FROM (
        SELECT 
          f_channel_id, 
          AVG(f_reliability_score)::INT as avg_score, 
          COUNT(*) as video_count
        FROM t_analyses
        WHERE f_is_latest = TRUE
          AND f_reliability_score IS NOT NULL
        GROUP BY f_channel_id
      ) sub
      WHERE c.f_channel_id = sub.f_channel_id
    `;
    const syncRes = await client.query(syncChannelsQuery);
    console.log(`   Updated ${syncRes.rowCount} channels\n`);

    await client.query('COMMIT');

    // 4. Verify results
    console.log('4️⃣  Verification:\n');
    
    const langStats = await client.query(`
      SELECT 
        f_language,
        COUNT(DISTINCT f_channel_id) as channels,
        COUNT(DISTINCT f_category_id) as categories
      FROM t_rankings_cache
      GROUP BY f_language
      ORDER BY channels DESC
    `);
    
    console.log('Language distribution:');
    console.table(langStats.rows);

    const newsRankings = await client.query(`
      SELECT 
        c.f_title,
        rc.f_language,
        rc.f_rank,
        rc.f_total_count
      FROM t_rankings_cache rc
      JOIN t_channels c ON rc.f_channel_id = c.f_channel_id
      WHERE rc.f_category_id = 25
        AND (c.f_title ILIKE '%NBC%' OR c.f_title ILIKE '%MBC%')
      ORDER BY rc.f_language, rc.f_rank
    `);
    
    if (newsRankings.rows.length > 0) {
      console.log('\nNews category rankings (NBC/MBC):');
      console.table(newsRankings.rows);
    }

    console.log('\n✅ Ranking cache refresh completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error refreshing cache:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

refreshRankingCache().catch(console.error);
