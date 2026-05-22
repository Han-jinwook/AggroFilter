import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMisses() {
  const client = await pool.connect();
  try {
    // 1. 전체 2024년 11월 1일 이후 업로드 영상의 분석 통계
    const statRes = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN f_grounding_used = true THEN 1 END) as grounding_used_true,
        COUNT(CASE WHEN f_grounding_used = false OR f_grounding_used IS NULL THEN 1 END) as grounding_used_false_or_null
      FROM t_analyses
      WHERE f_published_at >= '2024-11-01'
    `);
    
    console.log('=== 2024년 11월 1일 이후 업로드 영상 통계 ===');
    console.table(statRes.rows);

    // 2. grounding 미사용 영상 목록 (최근 20개)
    const listRes = await client.query(`
      SELECT 
        f_video_id,
        substring(f_title, 1, 30) as title_preview,
        f_published_at,
        f_created_at,
        f_accuracy_score,
        f_grounding_used
      FROM t_analyses
      WHERE f_published_at >= '2024-11-01'
        AND (f_grounding_used = false OR f_grounding_used IS NULL)
      ORDER BY f_created_at DESC
      LIMIT 20
    `);

    console.log('\n=== Google Search 미사용 영상 목록 (최근 20개) ===');
    console.table(listRes.rows);

    // 3. 전체 데이터 중 grounding 사용/미사용 분포
    const totalStatRes = await client.query(`
      SELECT 
        COUNT(*) as total_all,
        COUNT(CASE WHEN f_published_at >= '2024-11-01' THEN 1 END) as post_nov2024,
        COUNT(CASE WHEN f_published_at < '2024-11-01' OR f_published_at IS NULL THEN 1 END) as pre_nov2024
      FROM t_analyses
    `);
    console.log('\n=== 전체 분석 영상 분포 ===');
    console.table(totalStatRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMisses();
