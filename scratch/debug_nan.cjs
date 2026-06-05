const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const id = 'b7da6a39-d7ab-46f2-8f18-b4bc99e51dd4';
    console.log(`=== Querying for analysis ${id} ===`);
    
    const analysisRes = await client.query(`
      SELECT a.*,
             c.f_title as f_channel_name,
             c.f_thumbnail_url as f_channel_thumbnail,
             c.f_subscriber_count as f_subscriber_count,
             c.f_language as f_channel_language
      FROM t_analyses a 
      LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
      WHERE a.f_id = $1
    `, [id]);
    
    if (analysisRes.rows.length === 0) {
      console.log("No analysis found");
      return;
    }
    
    const analysis = analysisRes.rows[0];
    console.log("Analysis:", {
      f_id: analysis.f_id,
      f_title: analysis.f_title,
      f_channel_id: analysis.f_channel_id,
      f_accuracy_score: analysis.f_accuracy_score,
      f_clickbait_score: analysis.f_clickbait_score,
      f_reliability_score: analysis.f_reliability_score,
      f_official_category_id: analysis.f_official_category_id,
      f_channel_language: analysis.f_channel_language
    });
    
    const channelId = analysis.f_channel_id;
    const categoryId = analysis.f_official_category_id;
    const channelLanguage = analysis.f_channel_language || 'korean';

    console.log("\n=== Channel Info ===");
    const resChannel = await client.query(`
      SELECT f_channel_id, f_title, f_language FROM t_channels WHERE f_channel_id = $1
    `, [channelId]);
    console.log(resChannel.rows);

    console.log("\n=== Stats Res ===");
    const statsRes = await client.query(`
      SELECT f_avg_accuracy, f_avg_clickbait, f_avg_reliability 
      FROM t_channel_stats
      WHERE f_channel_id = $1 AND f_official_category_id = $2
    `, [channelId, categoryId]);
    console.log(statsRes.rows);

    console.log("\n=== Ranking Res ===");
    const rankingRes = await client.query(`
      WITH Ranked AS (
        SELECT 
          cs.f_channel_id,
          cs.f_avg_reliability,
          RANK() OVER (ORDER BY cs.f_avg_reliability DESC) as rank,
          COUNT(*) OVER () as total_count
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        WHERE cs.f_official_category_id = $2
          AND c.f_language = $3
      )
      SELECT rank, total_count,
        ROUND((rank::numeric / total_count) * 100) as top_percentile
      FROM Ranked
      WHERE f_channel_id = $1
    `, [channelId, categoryId, channelLanguage]);
    console.log(rankingRes.rows);

  } catch (error) {
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
