export const YOUTUBE_CATEGORIES: { [key: number]: string } = {
  22: "인물/블로그",
  24: "엔터테인먼트",
  25: "뉴스/정치",
  26: "노하우/스타일",
  27: "교육",
  28: "과학기술",
  29: "비영리/사회운동",
  100: "기타",
};

export const CORE_CATEGORIES = new Set([22, 24, 25, 26, 27, 28, 29]);

export function getRankingCategoryId(id: number): number {
  return CORE_CATEGORIES.has(id) ? id : 100;
}

export function getCategoryName(id: number): string {
  return YOUTUBE_CATEGORIES[id] || "기타";
}
