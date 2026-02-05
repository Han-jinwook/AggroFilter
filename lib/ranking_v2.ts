import { pool } from "@/lib/db";

/**
 * 랭킹 캐시 갱신 엔진 v2.0
 * 
 * 1. 각 채널의 언어(f_language)와 국가(f_country)를 기반으로 Ranking Key를 생성합니다.
 *    - Case A (고립어: ko, ja): [Language] + [Category ID] (국가 무시 통합)
 *    - Case B (범용어: en, es, fr 등): [Language] + [Country] + [Category ID] (국가별 분리)
 * 2. 해당 Key 내에서 순위를 매기고 상위 % (백분위)를 계산합니다.
 * 3. t_rankings_cache 테이블에 저장합니다.
 */
export async function refreshRankingCache(f_category_id?: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. 기존 캐시 삭제
    if (f_category_id) {
      await client.query("DELETE FROM t_rankings_cache WHERE f_category_id = $1", [f_category_id]);
    } else {
      await client.query("DELETE FROM t_rankings_cache");
    }

    // 2. 랭킹 계산 및 삽입 쿼리 (Smart Locale Strategy 반영)
    const rankingQuery = `
      INSERT INTO t_rankings_cache (
        f_channel_id, f_category_id, f_language, f_country, f_ranking_key, f_rank, f_total_count, f_top_percentile
      )
      WITH ChannelStats AS (
        SELECT 
          v.f_channel_id,
          v.f_official_category_id as category_id,
          c.f_language,
          c.f_country,
          -- Smart Locale Strategy 로직
          CASE 
            WHEN c.f_language IN ('ko', 'ja') THEN c.f_language || '_' || v.f_official_category_id::text
            ELSE c.f_language || '_' || c.f_country || '_' || v.f_official_category_id::text
          END as ranking_key,
          AVG(v.f_trust_score) as avg_score,
          COUNT(*) as video_count
        FROM t_videos v
        JOIN t_channels c ON v.f_channel_id = c.f_channel_id
        WHERE v.f_trust_score IS NOT NULL
        GROUP BY v.f_channel_id, v.f_official_category_id, c.f_language, c.f_country
      ),
      RankedChannels AS (
        SELECT 
          f_channel_id,
          category_id,
          f_language,
          f_country,
          ranking_key,
          RANK() OVER(PARTITION BY ranking_key ORDER BY avg_score DESC) as rank_num,
          COUNT(*) OVER(PARTITION BY ranking_key) as total_in_key
        FROM ChannelStats
        WHERE video_count >= 1
      )
      SELECT 
        f_channel_id,
        category_id,
        f_language,
        f_country,
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
    console.log(`[Ranking v2.0] Cache refreshed successfully ${f_category_id ? `for category ${f_category_id}` : "for all"}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Ranking v2.0] Cache refresh failed:", error);
    throw error;
  } finally {
    client.release();
  }
}
