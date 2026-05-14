const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEvalFormat() {
  try {
    const result = await pool.query(`
      SELECT 
        f_id, 
        f_video_id,
        f_accuracy_score,
        f_clickbait_score,
        f_reliability_score,
        f_evaluation_reason
      FROM t_analyses 
      ORDER BY f_created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No analysis found');
      return;
    }

    const row = result.rows[0];
    console.log('=== Latest Analysis ===');
    console.log('ID:', row.f_id);
    console.log('Video ID:', row.f_video_id);
    console.log('Scores:', {
      accuracy: row.f_accuracy_score,
      clickbait: row.f_clickbait_score,
      reliability: row.f_reliability_score
    });
    console.log('\n=== Evaluation Reason (First 800 chars) ===');
    console.log(row.f_evaluation_reason?.substring(0, 800));
    console.log('\n=== Format Check ===');
    
    // Check if scores are in title lines
    const hasScoreInTitle1 = /1\.\s*내용\s*정확성\s*검증\s*\(\s*\d+\s*점\s*\)/.test(row.f_evaluation_reason);
    const hasScoreInTitle2 = /2\.\s*어그로성\s*평가\s*\(\s*\d+\s*점/.test(row.f_evaluation_reason);
    const hasScoreInTitle3 = /3\.\s*신뢰도\s*총평\s*\(\s*\d+\s*점/.test(row.f_evaluation_reason);
    
    console.log('Score in title line 1 (정확성):', hasScoreInTitle1);
    console.log('Score in title line 2 (어그로):', hasScoreInTitle2);
    console.log('Score in title line 3 (신뢰도):', hasScoreInTitle3);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkEvalFormat();
