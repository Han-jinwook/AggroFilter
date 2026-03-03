export const YOUTUBE_CATEGORIES: { [key: number]: string } = {
  22: "인물/블로그",
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
