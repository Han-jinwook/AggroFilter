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

async function resetCache() {
  const client = await pool.connect();
  try {
    // 2024-11-01 이후 업로드 영상 중 Grounding 미사용 영상들의 캐시 리셋
    // f_reliability_score를 NULL로 설정하여, 사용자가 상세 조회 시 온디맨드로 신규 분석을 자동 유도하게 함.
    // (정치/시사/경제 등 민감한 키워드 대상만 우선 선별 리셋)
    
    console.log('Starting Cache Reset for grounding-missed political/news videos...');
    
    const query = `
      UPDATE t_analyses
      SET 
        f_reliability_score = NULL,
        f_accuracy_score = NULL,
        f_clickbait_score = NULL,
        f_processing_stage = 'pending',
        f_updated_at = NOW()
      WHERE f_published_at >= '2024-11-01'
        AND (f_grounding_used = false OR f_grounding_used IS NULL)
        AND (
          f_title ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
          OR f_transcript ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
        )
    `;

    const res = await client.query(query);
    console.log(`✅ 성공적으로 ${res.rowCount}개의 Grounding 누락 정치/시사 최신 영상 캐시를 리셋했습니다.`);
    console.log('이 영상들은 유저가 조회 시 새로운 분석 로직(Google Search 강제 탑재)으로 팩트체크되어 업데이트됩니다.');

  } catch (err) {
    console.error('Error resetting cache:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetCache();
