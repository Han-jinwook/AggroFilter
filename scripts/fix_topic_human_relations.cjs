const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixTopic() {
  const client = await pool.connect();
  try {
    console.log('Starting DB fix for topic "인간과의 관계" -> "인간 관계"...');
    await client.query('BEGIN');

    // 1. t_topics_master 수정
    // '인간 관계'가 이미 있는지 확인
    const checkRes = await client.query(`SELECT id FROM t_topics_master WHERE name_ko = '인간 관계'`);
    if (checkRes.rows.length > 0) {
        // 이미 존재하면, '인간과의 관계'는 삭제 (중복 방지)
        console.log("'인간 관계' topic already exists in master. Deleting '인간과의 관계'...");
        await client.query(`DELETE FROM t_topics_master WHERE name_ko = '인간과의 관계'`);
    } else {
        // 존재하지 않으면 이름 변경 시도
        console.log("Renaming '인간과의 관계' to '인간 관계' in master...");
        const updateRes = await client.query(`UPDATE t_topics_master SET name_ko = '인간 관계' WHERE name_ko = '인간과의 관계'`);
        if (updateRes.rowCount === 0) {
            console.log("'인간과의 관계' not found in master. Inserting '인간 관계' if not exists...");
            // 원래 없었으면 새로 추가 (혹시 모르니)
            await client.query(`
                INSERT INTO t_topics_master (name_ko) VALUES ('인간 관계') 
                ON CONFLICT (name_ko) DO NOTHING
            `);
        }
    }

    // 2. t_analyses 수정
    console.log("Updating t_analyses...");
    const analysisUpdateRes = await client.query(`
        UPDATE t_analyses 
        SET f_topic = '인간 관계' 
        WHERE f_topic = '인간과의 관계'
    `);
    console.log(`Updated ${analysisUpdateRes.rowCount} rows in t_analyses.`);

    // 3. t_channel_stats 재집계 준비
    // 기존 통계 데이터 삭제 (중복 키 오류 방지 및 깨끗한 재집계)
    console.log("Cleaning up t_channel_stats...");
    await client.query(`
        DELETE FROM t_channel_stats 
        WHERE f_topic IN ('인간과의 관계', '인간 관계')
    `);

    // 4. t_channel_stats 재집계 (인간 관계에 대해서만)
    console.log("Regenerating stats for '인간 관계'...");
    const statsInsertRes = await client.query(`
        INSERT INTO t_channel_stats (
          f_channel_id, f_topic, f_video_count, 
          f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
          f_last_updated
        )
        SELECT 
          f_channel_id, 
          '인간 관계', 
          COUNT(*)::integer, 
          ROUND(AVG(f_accuracy_score), 2), 
          ROUND(AVG(f_clickbait_score), 2), 
          ROUND(AVG(f_reliability_score), 2),
          NOW()
        FROM t_analyses
        WHERE f_topic = '인간 관계' AND f_channel_id IS NOT NULL AND f_reliability_score IS NOT NULL
        GROUP BY f_channel_id
    `);
    console.log(`Inserted ${statsInsertRes.rowCount} rows into t_channel_stats.`);

    await client.query('COMMIT');
    console.log('✅ Fix completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error during fix:', e);
  } finally {
    client.release();
    pool.end();
  }
}

fixTopic();
