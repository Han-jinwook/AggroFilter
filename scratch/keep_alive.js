const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
});

async function main() {
  try {
    console.log("Supabase Keep-Alive 활동 개시...");
    
    // 1. 더미 큐 데이터 삽입 (Write 발생)
    const insertQuery = `
      INSERT INTO t_analysis_queue (f_user_id, f_video_url, f_video_id, f_status)
      VALUES ('5ea629a5-574b-4529-b0c4-22535e391c94', 'https://youtu.be/keepalive_dummy', 'keepalive_d', 'failed')
      RETURNING f_id;
    `;
    const insertRes = await pool.query(insertQuery);
    const dummyId = insertRes.rows[0].f_id;
    console.log(`더미 데이터 삽입 완료! ID: ${dummyId}`);

    // 2. 더미 데이터 삭제 (Write/Delete 발생)
    const deleteRes = await pool.query(`
      DELETE FROM t_analysis_queue
      WHERE f_id = $1
    `, [dummyId]);
    console.log("더미 데이터 삭제 완료! DB 활성 감지 갱신 성공.");

  } catch (err) {
    console.error("Keep-Alive 쿼리 중 에러 발생:", err);
  } finally {
    await pool.end();
  }
}

main();
