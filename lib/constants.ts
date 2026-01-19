export const YOUTUBE_CATEGORIES: { [key: number]: string } = {
  1: "영화/애니메이션",
  2: "자동차/교통",
  10: "음악",
  15: "동물/애완",
  17: "스포츠",
  18: "단편영화",
  19: "여행/행사",
  20: "게임",
  21: "브이로그",
  22: "인물/블로그",
  23: "코미디",
  24: "엔터테인먼트",
  25: "뉴스/정치",
  26: "노하우/스타일",
  27: "교육",
  28: "과학기술",
  29: "비영리/사회운동",
};

export function getCategoryName(id: number): string {
  return YOUTUBE_CATEGORIES[id] || "기타";
}
