import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TChannelItem } from "@/types/T-ranking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const f_category_id = searchParams.get("f_category_id");
  const f_user_email = searchParams.get("f_user_email");

  if (!f_category_id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. 전체 랭킹 리스트 조회 (캐시 테이블 기반)
    const rankingQuery = `
      SELECT 
        c.f_id as f_channel_id,
        c.f_name as f_title,
        c.f_profile_image_url as f_thumbnail_url,
        c.f_trust_score,
        c.f_trust_grade,
        r.f_rank,
        r.f_total_count,
        r.f_top_percentile
      FROM t_rankings_cache r
      JOIN t_channels c ON r.f_channel_id = c.f_id
      WHERE r.f_category_id = $1
      ORDER BY r.f_rank ASC
      LIMIT 100
    `;
    const rankingRes = await client.query(rankingQuery, [f_category_id]);

    // 2. 내 채널 정보 조회 (로그인 시)
    let f_my_rank: TChannelItem | undefined;
    if (f_user_email) {
      const myRankQuery = `
        SELECT 
          c.f_id as f_channel_id,
          c.f_name as f_title,
          c.f_profile_image_url as f_thumbnail_url,
          c.f_trust_score,
          c.f_trust_grade,
          r.f_rank,
          r.f_total_count,
          r.f_top_percentile
        FROM t_rankings_cache r
        JOIN t_channels c ON r.f_channel_id = c.f_id
        WHERE r.f_category_id = $1 AND c.f_handle = $2
        LIMIT 1
      `;
      // f_handle이 이메일 형식으로 저장되어 있거나 별도 매핑이 필요할 수 있음
      // 여기서는 예시로 f_handle을 사용
      const myRankRes = await client.query(myRankQuery, [f_category_id, f_user_email]);
      if (myRankRes.rows.length > 0) {
        f_my_rank = {
          ...myRankRes.rows[0],
          f_is_my_channel: true,
        };
      }
    }

    return NextResponse.json({
      f_items: rankingRes.rows,
      f_my_rank: f_my_rank
    });

  } catch (error) {
    console.error("[Ranking API] Failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
