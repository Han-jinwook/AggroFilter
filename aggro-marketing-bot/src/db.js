const { Pool } = require('pg');
const { databaseUrl } = require('./config');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

/**
 * 최근 N일 이내에 이미 분석된 videoId 목록 조회
 */
async function getRecentlyAnalyzedVideoIds(days) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT f_video_id FROM t_analyses
       WHERE f_created_at > NOW() - INTERVAL '${days} days'
         AND f_video_id IS NOT NULL`
    );
    return new Set(result.rows.map((r) => r.f_video_id));
  } finally {
    client.release();
  }
}

/**
 * 최근 N일 이내에 이미 분석된 channelId 목록 조회
 */
async function getRecentlyAnalyzedChannelIds(days) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT f_channel_id FROM t_analyses
       WHERE f_created_at > NOW() - INTERVAL '${days} days'
         AND f_channel_id IS NOT NULL`
    );
    return new Set(result.rows.map((r) => r.f_channel_id));
  } finally {
    client.release();
  }
}

module.exports = { pool, getRecentlyAnalyzedVideoIds, getRecentlyAnalyzedChannelIds };
