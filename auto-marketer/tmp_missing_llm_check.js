const { pool } = require('./src/db');

async function main() {
  const detailSql = `
    SELECT
      kv.video_id,
      LEFT(kv.title, 90) AS title,
      kv.ollama_score,
      kv.collected_at,
      a_bot.f_user_id AS bot_user_id,
      a_bot.f_clickbait_score AS bot_clickbait,
      a_any.f_user_id AS any_user_id,
      a_any.f_clickbait_score AS any_clickbait,
      a_any.f_created_at AS any_created_at,
      CASE
        WHEN a_bot.f_clickbait_score IS NOT NULL THEN 'has_bot_analysis'
        WHEN a_any.f_clickbait_score IS NOT NULL THEN 'cached_non_bot_only'
        ELSE 'no_analysis_row'
      END AS reason
    FROM bot_keyword_videos kv
    LEFT JOIN LATERAL (
      SELECT x.f_user_id, x.f_clickbait_score, x.f_created_at
      FROM t_analyses x
      WHERE x.f_video_id = kv.video_id
        AND x.f_user_id IN ('bot-section2', 'bot')
      ORDER BY x.f_created_at DESC
      LIMIT 1
    ) a_bot ON true
    LEFT JOIN LATERAL (
      SELECT x.f_user_id, x.f_clickbait_score, x.f_created_at
      FROM t_analyses x
      WHERE x.f_video_id = kv.video_id
      ORDER BY x.f_created_at DESC
      LIMIT 1
    ) a_any ON true
    WHERE kv.ollama_score >= 31
      AND kv.collected_at >= TIMESTAMP '2026-03-25 14:30:00+00'
      AND kv.collected_at <= TIMESTAMP '2026-03-25 14:50:00+00'
    ORDER BY kv.collected_at DESC;
  `;

  const summarySql = `
    WITH rows AS (
      SELECT
        CASE
          WHEN a_bot.f_clickbait_score IS NOT NULL THEN 'has_bot_analysis'
          WHEN a_any.f_clickbait_score IS NOT NULL THEN 'cached_non_bot_only'
          ELSE 'no_analysis_row'
        END AS reason
      FROM bot_keyword_videos kv
      LEFT JOIN LATERAL (
        SELECT x.f_clickbait_score
        FROM t_analyses x
        WHERE x.f_video_id = kv.video_id
          AND x.f_user_id IN ('bot-section2', 'bot')
        ORDER BY x.f_created_at DESC
        LIMIT 1
      ) a_bot ON true
      LEFT JOIN LATERAL (
        SELECT x.f_clickbait_score
        FROM t_analyses x
        WHERE x.f_video_id = kv.video_id
        ORDER BY x.f_created_at DESC
        LIMIT 1
      ) a_any ON true
      WHERE kv.ollama_score >= 31
        AND kv.collected_at >= TIMESTAMP '2026-03-25 14:30:00+00'
        AND kv.collected_at <= TIMESTAMP '2026-03-25 14:50:00+00'
    )
    SELECT reason, COUNT(*)::int AS cnt
    FROM rows
    GROUP BY reason
    ORDER BY cnt DESC;
  `;

  const [detail, summary] = await Promise.all([
    pool.query(detailSql),
    pool.query(summarySql),
  ]);

  console.log('=== SUMMARY ===');
  console.table(summary.rows);
  console.log('\n=== DETAIL ===');
  console.table(detail.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
