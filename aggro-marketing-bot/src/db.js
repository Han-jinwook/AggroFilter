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

// ────────────── bot_community_targets ──────────────

async function getCommunityTargets(activeOnly = true) {
  const client = await pool.connect();
  try {
    const where = activeOnly ? 'WHERE is_active = true' : '';
    const result = await client.query(
      `SELECT * FROM bot_community_targets ${where} ORDER BY id ASC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function upsertCommunityTarget({ id, url, keywords, is_active, note, community_type, community_name, nickname, login_id, login_pw, post_limit, keywords_global }) {
  const client = await pool.connect();
  try {
    if (id) {
      const result = await client.query(
        `UPDATE bot_community_targets
         SET url=$1, keywords=$2, is_active=$3, note=$4,
             community_type=$6, community_name=$7, nickname=$8,
             login_id=$9, login_pw=$10, post_limit=$11, keywords_global=$12,
             updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [url, keywords, is_active ?? true, note ?? null, id,
         community_type ?? 'general', community_name ?? null, nickname ?? null,
         login_id ?? null, login_pw ?? null, post_limit ?? 10, keywords_global ?? null]
      );
      return result.rows[0];
    } else {
      const result = await client.query(
        `INSERT INTO bot_community_targets
           (url, keywords, is_active, note, community_type, community_name, nickname, login_id, login_pw, post_limit, keywords_global)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [url, keywords, is_active ?? true, note ?? null,
         community_type ?? 'general', community_name ?? null, nickname ?? null,
         login_id ?? null, login_pw ?? null, post_limit ?? 10, keywords_global ?? null]
      );
      return result.rows[0];
    }
  } finally {
    client.release();
  }
}

async function deleteCommunityTarget(id) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM bot_community_targets WHERE id=$1', [id]);
  } finally {
    client.release();
  }
}

// ────────────── bot_comment_logs ──────────────

async function insertCommentLog({ target_type, target_id, target_url, video_id, grade, generated_text }) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO bot_comment_logs
         (target_type, target_id, target_url, video_id, grade, generated_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'queue') RETURNING *`,
      [target_type, target_id, target_url ?? null, video_id ?? null, grade ?? null, generated_text]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateCommentLogStatus(id, status, errorMessage = null) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE bot_comment_logs
       SET status=$1, error_message=$2, posted_at=CASE WHEN $1='done' THEN NOW() ELSE posted_at END
       WHERE id=$3`,
      [status, errorMessage, id]
    );
  } finally {
    client.release();
  }
}

async function getCommentLogs({ limit = 100, status = null } = {}) {
  const client = await pool.connect();
  try {
    const where = status ? `WHERE status = '${status}'` : '';
    const result = await client.query(
      `SELECT * FROM bot_comment_logs ${where} ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  getRecentlyAnalyzedVideoIds,
  getRecentlyAnalyzedChannelIds,
  getCommunityTargets,
  upsertCommunityTarget,
  deleteCommunityTarget,
  insertCommentLog,
  updateCommentLogStatus,
  getCommentLogs,
};
