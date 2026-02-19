const { Pool } = require('pg');
const path = require('path');

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

async function initRankingCache() {
  const client = await pool.connect();
  try {
    console.log('🌍 Initializing Global Ranking Cache v3.1...\n');
    
    await client.query("BEGIN");

    // 1. 기존 캐시 삭제
    console.log('Step 1: Clearing existing cache...');
    await client.query("DELETE FROM t_rankings_cache");
    console.log('✅ Cache cleared\n');

    // 2. 랭킹 계산 및 삽입
    console.log('Step 2: Calculating rankings...');
    const rankingQuery = `
      INSERT INTO t_rankings_cache (
        f_channel_id, f_category_id, f_language, f_ranking_key, f_rank, f_total_count, f_top_percentile
      )
      WITH ChannelStats AS (
        SELECT 
          cs.f_channel_id,
          cs.f_official_category_id as category_id,
          COALESCE(c.f_language, 'korean') as language,
          COALESCE(c.f_language, 'korean') || '_' || cs.f_official_category_id::text as ranking_key,
          cs.f_avg_reliability as avg_score,
          cs.f_video_count as video_count
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        WHERE cs.f_avg_reliability IS NOT NULL
          AND cs.f_official_category_id IS NOT NULL
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

    const result = await client.query(rankingQuery);
    console.log(`✅ Inserted ${result.rowCount} ranking entries\n`);

    await client.query("COMMIT");
    
    // 3. 결과 확인
    console.log('Step 3: Verifying results...');
    const summary = await client.query(`
      SELECT 
        f_language,
        f_category_id,
        COUNT(*) as channel_count,
        MIN(f_rank) as min_rank,
        MAX(f_rank) as max_rank
      FROM t_rankings_cache
      GROUP BY f_language, f_category_id
      ORDER BY f_language, f_category_id
    `);
    
    console.log('\n📊 Ranking Cache Summary:');
    console.log('Language | Category | Channels | Rank Range');
    console.log('---------|----------|----------|------------');
    summary.rows.forEach(row => {
      console.log(`${row.f_language.padEnd(8)} | ${String(row.f_category_id).padEnd(8)} | ${String(row.channel_count).padEnd(8)} | ${row.min_rank}-${row.max_rank}`);
    });
    
    console.log('\n✅ Ranking cache initialized successfully!');
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error('❌ Error initializing ranking cache:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initRankingCache();
