const { pool } = require('./src/db');

async function main() {
  const sql = `
    WITH latest AS (
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
      ORDER BY a.f_created_at DESC
      LIMIT 9
    )
    SELECT
      video_id,
      LEFT(title, 80) AS title,
      ollama_score,
      llm_score,
      (ollama_score - llm_score) AS diff,
      ABS(ollama_score - llm_score) AS abs_diff,
      analyzed_at
    FROM latest
    ORDER BY analyzed_at DESC;
  `;

  const res = await pool.query(sql);
  const rows = res.rows || [];

  console.log('=== LAST 9 (OLLAMA vs LLM) ===');
  console.table(rows);

  const metrics = rows.reduce((acc, row) => {
    const d = Math.abs(Number(row.abs_diff || 0));
    acc.sum += d;
    acc.max = Math.max(acc.max, d);
    if (d <= 5) acc.b5 += 1;
    else if (d <= 10) acc.b10 += 1;
    else if (d <= 20) acc.b20 += 1;
    else acc.b21 += 1;
    return acc;
  }, { sum: 0, max: 0, b5: 0, b10: 0, b20: 0, b21: 0 });

  const n = rows.length;
  const mae = n ? Number((metrics.sum / n).toFixed(2)) : null;

  console.log('\n=== SUMMARY ===');
  console.log({
    n,
    mae,
    max_abs: metrics.max,
    bucket: {
      '0~5': metrics.b5,
      '6~10': metrics.b10,
      '11~20': metrics.b20,
      '21+': metrics.b21,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
