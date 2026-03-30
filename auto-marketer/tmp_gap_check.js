const { pool } = require('./src/db');

async function main() {
  const statsSql = `
    WITH joined AS (
      SELECT
        kv.video_id,
        kv.title,
        kv.ollama_score::int AS ollama_score,
        a.f_clickbait_score::int AS llm_score,
        a.f_created_at AS analyzed_at,
        kv.collected_at
      FROM bot_keyword_videos kv
      JOIN LATERAL (
        SELECT x.f_clickbait_score, x.f_created_at
        FROM t_analyses x
        WHERE x.f_video_id = kv.video_id
          AND x.f_user_id IN ('bot-section2', 'bot')
        ORDER BY x.f_created_at DESC
        LIMIT 1
      ) a ON true
      WHERE kv.ollama_score IS NOT NULL
        AND a.f_clickbait_score IS NOT NULL
    ),
    recent AS (
      SELECT *
      FROM joined
      WHERE analyzed_at >= NOW() - INTERVAL '7 days'
    )
    SELECT
      'overall' AS scope,
      COUNT(*)::int AS n,
      ROUND(AVG(ABS(ollama_score - llm_score))::numeric, 2) AS mae,
      ROUND(AVG((ollama_score - llm_score))::numeric, 2) AS bias,
      ROUND(MAX(ABS(ollama_score - llm_score))::numeric, 2) AS max_abs,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(ollama_score - llm_score))::numeric, 2) AS p50_abs,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ABS(ollama_score - llm_score))::numeric, 2) AS p90_abs
    FROM joined
    UNION ALL
    SELECT
      'recent_7d' AS scope,
      COUNT(*)::int AS n,
      ROUND(AVG(ABS(ollama_score - llm_score))::numeric, 2) AS mae,
      ROUND(AVG((ollama_score - llm_score))::numeric, 2) AS bias,
      ROUND(MAX(ABS(ollama_score - llm_score))::numeric, 2) AS max_abs,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(ollama_score - llm_score))::numeric, 2) AS p50_abs,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ABS(ollama_score - llm_score))::numeric, 2) AS p90_abs
    FROM recent;
  `;

  const topSql = `
    WITH joined AS (
      SELECT
        kv.video_id,
        kv.title,
        kv.ollama_score::int AS ollama_score,
        a.f_clickbait_score::int AS llm_score,
        a.f_created_at AS analyzed_at
      FROM bot_keyword_videos kv
      JOIN LATERAL (
        SELECT x.f_clickbait_score, x.f_created_at
        FROM t_analyses x
        WHERE x.f_video_id = kv.video_id
          AND x.f_user_id IN ('bot-section2', 'bot')
        ORDER BY x.f_created_at DESC
        LIMIT 1
      ) a ON true
      WHERE kv.ollama_score IS NOT NULL
        AND a.f_clickbait_score IS NOT NULL
    )
    SELECT
      video_id,
      LEFT(title, 80) AS title,
      ollama_score,
      llm_score,
      (ollama_score - llm_score) AS diff,
      ABS(ollama_score - llm_score) AS abs_diff,
      analyzed_at
    FROM joined
    ORDER BY abs_diff DESC, analyzed_at DESC
    LIMIT 10;
  `;

  const bucketSql = `
    WITH joined AS (
      SELECT
        kv.ollama_score::int AS ollama_score,
        a.f_clickbait_score::int AS llm_score
      FROM bot_keyword_videos kv
      JOIN LATERAL (
        SELECT x.f_clickbait_score
        FROM t_analyses x
        WHERE x.f_video_id = kv.video_id
          AND x.f_user_id IN ('bot-section2', 'bot')
        ORDER BY x.f_created_at DESC
        LIMIT 1
      ) a ON true
      WHERE kv.ollama_score IS NOT NULL
        AND a.f_clickbait_score IS NOT NULL
    ),
    bucketed AS (
      SELECT
        CASE
          WHEN ABS(ollama_score - llm_score) <= 5 THEN '0~5'
          WHEN ABS(ollama_score - llm_score) <= 10 THEN '6~10'
          WHEN ABS(ollama_score - llm_score) <= 20 THEN '11~20'
          ELSE '21+'
        END AS gap_bucket,
        CASE
          WHEN ABS(ollama_score - llm_score) <= 5 THEN 1
          WHEN ABS(ollama_score - llm_score) <= 10 THEN 2
          WHEN ABS(ollama_score - llm_score) <= 20 THEN 3
          ELSE 4
        END AS sort_key
      FROM joined
    )
    SELECT
      gap_bucket,
      COUNT(*)::int AS cnt,
      MIN(sort_key) AS sort_key
    FROM bucketed
    GROUP BY gap_bucket
    ORDER BY sort_key;
  `;

  const [stats, top, buckets] = await Promise.all([
    pool.query(statsSql),
    pool.query(topSql),
    pool.query(bucketSql),
  ]);

  console.log('=== GAP STATS ===');
  console.table(stats.rows);

  console.log('\n=== GAP BUCKETS ===');
  console.table(buckets.rows);

  console.log('\n=== TOP 10 ABS GAP ===');
  console.table(top.rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
