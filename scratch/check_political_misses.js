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

async function checkPoliticalMisses() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        f_video_id,
        f_title,
        f_published_at,
        f_created_at,
        f_accuracy_score,
        f_clickbait_score
      FROM t_analyses
      WHERE f_published_at >= '2024-11-01'
        AND (f_grounding_used = false OR f_grounding_used IS NULL)
        AND (
          f_title ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
          OR f_transcript ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
        )
      ORDER BY f_created_at DESC
    `;

    const res = await client.query(query);
    console.log(`=== 2024년 11월 1일 이후 최신 영상 중 Grounding 누락된 정치/시사/뉴스 타겟 영상 목록 (${res.rows.length}개) ===`);
    res.rows.forEach((row, i) => {
      console.log(`${i+1}. [${row.f_video_id}] ${row.f_title}`);
      console.log(`   - 업로드: ${row.f_published_at?.toISOString()} | 분석일: ${row.f_created_at?.toISOString()}`);
      console.log(`   - 정확도: ${row.f_accuracy_score}점 | 어그로: ${row.f_clickbait_score}점`);
      console.log('----------------------------------------------------');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPoliticalMisses();
