import { pool } from "@/lib/db";
import { getLanguageDisplayName, getLanguageIcon } from "@/lib/language-detection";

/**
 * 랭킹 캐시 갱신 엔진 v3.1 (Language-Only)
 * 
 * 1. 각 채널의 언어(f_language)만을 기반으로 Ranking Key를 생성합니다.
 *    - 국가(f_country) 구분 제거: 모든 언어를 국가 구분 없이 통합
 *    - Ranking Key 형식: [Language]_[Category ID] (예: ko_10, en_25)
 * 2. 해당 Key 내에서 순위를 매기고 상위 % (백분위)를 계산합니다.
 * 3. t_rankings_cache 테이블에 저장합니다.
 */
export async function refreshRankingCache(f_category_id?: number) {
  const connectWithRetry = async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await pool.connect();
      } catch (e) {
        lastError = e;
        const delayMs = 250 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  };

  const client = await connectWithRetry();
  try {
    await client.query("BEGIN");

    // 1. 기존 캐시 삭제
    if (f_category_id) {
      await client.query("DELETE FROM t_rankings_cache WHERE f_category_id = $1", [f_category_id]);
    } else {
      await client.query("DELETE FROM t_rankings_cache");
    }

    // 2. 랭킹 계산 및 삽입 쿼리 (Language-Only Strategy)
    const rankingQuery = `
      INSERT INTO t_rankings_cache (
        f_channel_id, f_category_id, f_language, f_ranking_key, f_rank, f_total_count, f_top_percentile
      )
      WITH ChannelStats AS (
        SELECT 
          cs.f_channel_id,
          cs.f_official_category_id as category_id,
          COALESCE(c.f_language, 'korean') as language,
          -- Ranking Key: language_categoryId (예: korean_10, english_25)
          COALESCE(c.f_language, 'korean') || '_' || cs.f_official_category_id::text as ranking_key,
          cs.f_avg_reliability as avg_score,
          cs.f_video_count as video_count
        FROM t_channel_stats cs
        JOIN t_channels c ON cs.f_channel_id = c.f_channel_id
        WHERE cs.f_avg_reliability IS NOT NULL
          AND cs.f_official_category_id IS NOT NULL
      ),
      RankedChannels AS (
        SELECT 
          f_channel_id,
          category_id,
          language,
          ranking_key,
          RANK() OVER(PARTITION BY ranking_key ORDER BY avg_score DESC) as rank_num,
          COUNT(*) OVER(PARTITION BY ranking_key) as total_in_key
        FROM ChannelStats
        WHERE video_count >= 1
      )
      SELECT 
        f_channel_id,
        category_id,
        language,
        ranking_key,
        rank_num,
        total_in_key,
        ROUND((rank_num::decimal / total_in_key::decimal) * 100, 2) as top_percentile
      FROM RankedChannels
      ${f_category_id ? "WHERE category_id = $1" : ""}
    `;

    const params = f_category_id ? [f_category_id] : [];
    await client.query(rankingQuery, params);

    // 3. t_channels 테이블의 f_trust_score, f_trust_grade 등 기본 정보도 업데이트
    await client.query(`
      UPDATE t_channels c
      SET 
        f_trust_score = sub.avg_score,
        f_video_count = sub.video_count,
        f_trust_grade = CASE 
          WHEN sub.avg_score >= 70 THEN 'green'
          WHEN sub.avg_score >= 50 THEN 'yellow'
          ELSE 'red'
        END
      FROM (
        SELECT f_channel_id, AVG(f_trust_score) as avg_score, COUNT(*) as video_count
        FROM t_videos
        GROUP BY f_channel_id
      ) sub
      WHERE c.f_channel_id = sub.f_channel_id
    `);

    await client.query("COMMIT");
    console.log(`[Ranking v3.1] Language-only cache refreshed successfully ${f_category_id ? `for category ${f_category_id}` : "for all"}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Ranking v3.1] Cache refresh failed:", error);
    throw error;
  } finally {
    client.release();
  }
}
