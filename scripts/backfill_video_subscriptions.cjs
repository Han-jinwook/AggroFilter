/**
 * 백필: 기존 t_channel_subscriptions 기반으로 t_video_subscriptions 생성
 * 
 * 로직:
 * - 각 유저의 구독 채널에 대해, 해당 채널의 분석 영상 중
 *   유저가 직접 분석(f_user_id 일치)했거나 결과 조회(f_view_count > 0)한 영상을 매칭
 * - 매칭 안 되면, 채널 구독일 이전에 생성된 최신 분석 영상들을 구독일로 백필
 * - f_subscribed_at = 채널 구독일 (정확한 진입 시각은 알 수 없으므로)
 * 
 * 사용법: node scripts/backfill_video_subscriptions.cjs
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    // 테이블 보장
    await client.query(`
      CREATE TABLE IF NOT EXISTS t_video_subscriptions (
        f_id BIGSERIAL PRIMARY KEY,
        f_user_id TEXT NOT NULL,
        f_video_id TEXT NOT NULL,
        f_channel_id TEXT NOT NULL,
        f_subscribed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(f_user_id, f_video_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_video_subs_user ON t_video_subscriptions(f_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_video_subs_channel ON t_video_subscriptions(f_user_id, f_channel_id)`);

    // 모든 채널 구독 가져오기
    const subs = await client.query(`
      SELECT f_user_id, f_channel_id, f_subscribed_at
      FROM t_channel_subscriptions
      ORDER BY f_subscribed_at ASC
    `);

    console.log(`총 ${subs.rows.length}개 채널 구독 처리 시작...`);

    let inserted = 0;
    let skipped = 0;

    for (const sub of subs.rows) {
      const { f_user_id, f_channel_id, f_subscribed_at } = sub;
      const subDate = f_subscribed_at || new Date();

      // 방법 1: 유저가 직접 분석한 영상 (f_user_id 일치)
      const ownedVideos = await client.query(`
        SELECT DISTINCT f_video_id
        FROM t_analyses
        WHERE f_channel_id = $1 AND f_user_id = $2 AND f_video_id IS NOT NULL
      `, [f_channel_id, f_user_id]);

      // 방법 2: 직접 분석한 게 없으면 채널의 최신 분석 영상(최대 10개)을 구독일로 백필
      let videoIds = ownedVideos.rows.map(r => r.f_video_id);

      if (videoIds.length === 0) {
        const channelVideos = await client.query(`
          SELECT DISTINCT ON (f_video_id) f_video_id
          FROM t_analyses
          WHERE f_channel_id = $1 AND f_video_id IS NOT NULL
          ORDER BY f_video_id, f_created_at DESC
          LIMIT 10
        `, [f_channel_id]);
        videoIds = channelVideos.rows.map(r => r.f_video_id);
      }

      for (const videoId of videoIds) {
        try {
          const res = await client.query(`
            INSERT INTO t_video_subscriptions (f_user_id, f_video_id, f_channel_id, f_subscribed_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (f_user_id, f_video_id) DO NOTHING
            RETURNING f_id
          `, [f_user_id, videoId, f_channel_id, subDate]);

          if (res.rowCount > 0) inserted++;
          else skipped++;
        } catch (err) {
          console.error(`Error inserting ${f_user_id}/${videoId}:`, err.message);
        }
      }
    }

    console.log(`\n백필 완료: ${inserted}개 삽입, ${skipped}개 스킵(이미 존재)`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('백필 실패:', err);
  process.exit(1);
});
