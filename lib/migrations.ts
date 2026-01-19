import { pool } from '@/lib/db';

export async function migrateV2() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. t_channels 테이블 필드 추가 및 변경
    await client.query(`
      ALTER TABLE t_channels 
      ADD COLUMN IF NOT EXISTS f_official_category_id INT,
      ADD COLUMN IF NOT EXISTS f_custom_category_id INT,
      ADD COLUMN IF NOT EXISTS f_trust_score INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS f_trust_grade VARCHAR(10),
      ADD COLUMN IF NOT EXISTS f_video_count INT DEFAULT 0;
    `);

    // 2. t_videos 테이블 필드 추가 및 변경 (기존 t_analyses 참고)
    await client.query(`
      ALTER TABLE t_videos 
      ADD COLUMN IF NOT EXISTS f_official_category_id INT,
      ADD COLUMN IF NOT EXISTS f_custom_category_id INT,
      ADD COLUMN IF NOT EXISTS f_accuracy_score INT,
      ADD COLUMN IF NOT EXISTS f_clickbait_score INT,
      ADD COLUMN IF NOT EXISTS f_trust_score INT,
      ADD COLUMN IF NOT EXISTS f_ai_recommended_title TEXT,
      ADD COLUMN IF NOT EXISTS f_summary TEXT,
      ADD COLUMN IF NOT EXISTS f_evaluation_reason TEXT;
    `);

      // 3. t_rankings_cache 테이블 생성 및 글로벌 전략 필드 추가
    await client.query(`
      CREATE TABLE IF NOT EXISTS t_rankings_cache (
          f_id SERIAL PRIMARY KEY,
          f_channel_id VARCHAR(255) REFERENCES t_channels(f_id),
          f_category_id INT,
          f_language VARCHAR(10),
          f_country VARCHAR(10),
          f_ranking_key VARCHAR(100), -- [Language]+[Category] 또는 [Language]+[Country]+[Category]
          f_rank INT,
          f_total_count INT,
          f_top_percentile DECIMAL(5,2),
          f_cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. t_channels에 국가/언어 필드 추가
    await client.query(`
      ALTER TABLE t_channels 
      ADD COLUMN IF NOT EXISTS f_language VARCHAR(10) DEFAULT 'ko',
      ADD COLUMN IF NOT EXISTS f_country VARCHAR(10) DEFAULT 'KR';
    `);

    await client.query('COMMIT');
    console.log('V2 Migration Successful');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('V2 Migration Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
