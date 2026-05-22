const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
});

async function main() {
  try {
    // 1. 영상 제목으로 검색
    const query = `
      SELECT f_id, f_video_id, f_title, f_accuracy_score, f_clickbait_score, f_reliability_score, 
             f_grounding_used, f_grounding_queries, f_tokens_speed, f_tokens_full, f_grounding_count, 
             f_user_id, f_created_at, f_evaluation_reason
      FROM t_analyses
      WHERE f_title LIKE '%이재용은 어떻게 이재명%'
      ORDER BY f_created_at DESC;
    `;
    const res = await pool.query(query);
    console.log("--- Analyses Results ---");
    console.log(JSON.stringify(res.rows, null, 2));

    if (res.rows.length > 0) {
      const videoId = res.rows[0].f_video_id;
      // 2. 해당 videoId로 t_credit_history 조회? t_credit_history는 user_id로 조회해야 함
      const userId = res.rows[0].f_user_id;
      console.log(`\nUser ID: ${userId}, Video ID: ${videoId}`);

      // t_credit_history가 있는지 확인하고 조회
      const creditHistoryRes = await pool.query(`
        SELECT * FROM t_credit_history
        WHERE f_user_id = $1
        ORDER BY f_id DESC
        LIMIT 10;
      `, [userId]);
      console.log("\n--- Credit History Results ---");
      console.log(JSON.stringify(creditHistoryRes.rows, null, 2));
    }
  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await pool.end();
  }
}

main();
