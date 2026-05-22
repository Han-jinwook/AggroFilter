import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeContent } from '../lib/gemini.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runReanalysis() {
  const client = await pool.connect();
  try {
    // 1. 재분석 대상 영상 조회
    // 2024년 11월 1일 이후 최신 영상 중 Grounding 미사용이고 정치/시사/뉴스/경제 키워드가 들어간 최신 분석 레코드 대상
    const query = `
      SELECT 
        f_id,
        f_video_id,
        f_video_url,
        f_title,
        f_channel_id,
        f_thumbnail_url,
        f_transcript,
        f_published_at,
        f_official_category_id,
        f_view_count
      FROM t_analyses
      WHERE f_published_at >= '2024-11-01'
        AND (f_grounding_used = false OR f_grounding_used IS NULL)
        AND f_is_latest = true
        AND (
          f_title ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
          OR f_transcript ~ '선거|경선|투표|대선|총선|보궐|지방선거|당선|낙선|출마|사퇴|탄핵|임명|해임|국회|여당|야당|민주당|국민의힘|대통령|지사|시장|의원|속보|긴급|수사|체포|구속|판결|기소|이재명|이재용|한동훈|파업|삼성|카카오|윤석열'
        )
      ORDER BY f_created_at DESC
    `;

    const targetRes = await client.query(query);
    const targets = targetRes.rows;
    console.log(`[Reanalysis] Found ${targets.length} target videos for fact-check reanalysis.`);

    if (targets.length === 0) {
      console.log('No videos require reanalysis.');
      return;
    }

    for (let i = 0; i < targets.length; i++) {
      const video = targets[i];
      console.log(`\n[${i + 1}/${targets.length}] Reanalyzing: [${video.f_video_id}] "${video.f_title}"`);
      
      try {
        // 채널명 조회 시도
        let channelName = '알 수 없음';
        if (video.f_channel_id) {
          const chRes = await client.query('SELECT f_title FROM t_channels WHERE f_channel_id = $1', [video.f_channel_id]);
          if (chRes.rows.length > 0) {
            channelName = chRes.rows[0].f_title;
          }
        }

        // Gemini 팩트체크 분석 실행 (publishedAt이 2024-11-01 이후이므로 내부에서 구글 검색이 강제 적용됨)
        const analysisResult = await analyzeContent(
          channelName,
          video.f_title,
          video.f_transcript || '',
          video.f_thumbnail_url || '',
          undefined, // duration
          undefined, // transcriptItems
          video.f_published_at?.toISOString(),
          'korean'
        );

        const newAnalysisId = uuidv4();

        // 트랜잭션 처리
        await client.query('BEGIN');

        // 기존 분석들의 f_is_latest = FALSE 처리
        await client.query(`
          UPDATE t_analyses 
          SET f_is_latest = FALSE 
          WHERE f_video_id = $1
        `, [video.f_video_id]);

        // 신규 분석 결과 저장
        await client.query(`
          INSERT INTO t_analyses (
            f_id, f_video_url, f_video_id, f_title, f_channel_id,
            f_thumbnail_url, f_transcript, f_accuracy_score, f_clickbait_score,
            f_reliability_score, f_summary, f_evaluation_reason, f_overall_assessment,
            f_ai_title_recommendation, f_user_id, f_official_category_id, f_request_count,
            f_view_count, f_created_at, f_last_action_at, f_is_recheck,
            f_recheck_parent_analysis_id, f_recheck_at, f_is_latest, f_language,
            f_grounding_used, f_grounding_queries, f_published_at, f_is_valid,
            f_needs_review, f_review_reason, f_fact_spoiler, f_fact_timestamp,
            f_processing_stage
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, NULL, $15, 1,
            $16, NOW(), NOW(), TRUE,
            $17, NOW(), TRUE, 'ko',
            $18, $19, $20, TRUE,
            FALSE, NULL, $21, NULL,
            'completed'
          )
        `, [
          newAnalysisId,
          video.f_video_url,
          video.f_video_id,
          video.f_title,
          video.f_channel_id,
          video.f_thumbnail_url,
          video.f_transcript,
          analysisResult.accuracy,
          analysisResult.clickbait,
          analysisResult.reliability,
          analysisResult.subtitleSummary || null,
          analysisResult.evaluationReason || null,
          analysisResult.overallAssessment || null,
          analysisResult.recommendedTitle || null,
          video.f_official_category_id,
          video.f_view_count || 0,
          video.f_id, // parent_id
          analysisResult.groundingUsed,
          analysisResult.groundingQueries?.length > 0 ? analysisResult.groundingQueries : null,
          video.f_published_at,
          Array.isArray(analysisResult.thumbnail_spoiler) ? JSON.stringify(analysisResult.thumbnail_spoiler) : (analysisResult.thumbnail_spoiler || null)
        ]);

        await client.query('COMMIT');

        console.log(`✅ Success: Acc(${analysisResult.accuracy}) / Click(${analysisResult.clickbait}) / Rel(${analysisResult.reliability})`);
        console.log(`   Grounding Used: ${analysisResult.groundingUsed} (Queries: ${JSON.stringify(analysisResult.groundingQueries)})`);

        // API Rate Limit을 방지하기 위한 대기 시간 (약 2초)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to reanalyze video ${video.f_video_id}:`, err.message);
        
        // Quota Exhausted 에러 시 즉시 루프 중단
        if (err.message?.includes('429') || err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('resource exhausted')) {
          console.error('🚨 Gemini API quota limit reached. Stopping batch process.');
          break;
        }
      }
    }

  } catch (err) {
    console.error('Batch process critical error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runReanalysis();
