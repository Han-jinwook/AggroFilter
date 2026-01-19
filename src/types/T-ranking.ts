import { LucideIcon } from "lucide-react";

/**
 * YouTube 공식 카테고리 ID 및 매핑
 */
export const YOUTUBE_CATEGORIES: Record<number, { name: string; icon?: string }> = {
  1: { name: "영화/애니메이션" },
  2: { name: "자동차/교통" },
  10: { name: "음악" },
  15: { name: "반려동물/동물" },
  17: { name: "스포츠" },
  18: { name: "단편 영화" },
  19: { name: "여행/이벤트" },
  20: { name: "게임" },
  21: { name: "비디오 블로그" },
  22: { name: "인물/블로그" }, // Track A: 고위험군
  23: { name: "코미디" },
  24: { name: "엔터테인먼트" }, // Track A: 고위험군
  25: { name: "뉴스/정치" },
  26: { name: "노하우/스타일" },
  27: { name: "교육" },
  28: { name: "과학기술" },
  29: { name: "비영리/사회운동" },
};

/**
 * 데이터 필드 인터페이스 (Prefix f_)
 */
export interface TChannelItem {
  f_channel_id: string;
  f_title: string;
  f_thumbnail_url: string;
  f_trust_score: number;
  f_trust_grade: "green" | "yellow" | "red";
  f_rank: number;
  f_total_count: number;
  f_top_percentile: number;
  f_is_my_channel?: boolean;
}

export interface TRankingResponse {
  f_items: TChannelItem[];
  f_next_cursor?: string;
  f_my_rank?: TChannelItem;
}
