const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function backfillCategories() {
  const client = await pool.connect();
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    console.log('--- Start Backfill Categories ---');
    
    // 1. 카테고리 ID가 없는 영상 ID 추출
    const { rows: targets } = await client.query(`
      SELECT f_video_id, f_id
      FROM t_analyses 
      WHERE f_official_category_id IS NULL 
      LIMIT 50
    `);

    if (targets.length === 0) {
      console.log('No targets found for backfill.');
      return;
    }

    console.log(`Found ${targets.length} videos to update.`);

    for (const target of targets) {
      const videoId = target.f_video_id;
      const analysisId = target.f_id; // UUID
      
      try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.items && data.items.length > 0) {
          const categoryId = parseInt(data.items[0].snippet.categoryId, 10);
          const channelId = data.items[0].snippet.channelId;
          const title = data.items[0].snippet.title;

          console.log(`Updating Video [${videoId}]: ${title} -> Category ${categoryId}`);

          await client.query('BEGIN');
          
          // t_analyses 업데이트 (analysisId는 UUID이므로 명시적 형변환 없이 사용 가능하거나 f_video_id 사용)
          await client.query(`
            UPDATE t_analyses 
            SET f_official_category_id = $1 
            WHERE f_video_id = $2
          `, [categoryId, videoId]);

          // t_videos 삽입/업데이트
          await client.query(`
            INSERT INTO t_videos (
              f_video_id, f_channel_id, f_title, f_official_category_id, f_trust_score, f_created_at
            )
            SELECT f_video_id, f_channel_id, f_title, $1, f_reliability_score, f_created_at
            FROM t_analyses
            WHERE f_video_id = $2
            ON CONFLICT (f_video_id) DO UPDATE SET f_official_category_id = $1
          `, [categoryId, videoId]);

          // 채널 정보도 업데이트
          await client.query(`
            UPDATE t_channels 
            SET f_official_category_id = $1 
            WHERE f_channel_id = $2
          `, [categoryId, channelId]);

          await client.query('COMMIT');
        } else {
          console.log(`Video [${videoId}] not found on YouTube or private.`);
        }
      } catch (err) {
        console.error(`Error processing video ${videoId}:`, err.message);
        await client.query('ROLLBACK');
      }
      
      // API 할당량 배려를 위한 미세 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('--- Backfill Batch Completed ---');
  } catch (error) {
    console.error('Backfill process failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

backfillCategories();
