// YouTube 공식 카테고리 ID 매핑
export const YOUTUBE_CATEGORY_MAP: Record<number, string> = {
  1: '영화 & 애니메이션',
  2: '자동차 & 차량',
  10: '음악',
  15: '애완동물 & 동물',
  17: '스포츠',
  19: '여행 & 이벤트',
  20: '게임',
  22: '인물 & 블로그',
  23: '코미디',
  24: '엔터테인먼트',
  25: '뉴스 & 정치',
  26: '노하우 & 스타일',
  27: '교육',
  28: '과학 & 기술',
  29: '비영리 & 사회운동'
};

export function getCategoryName(categoryId: number): string {
  return YOUTUBE_CATEGORY_MAP[categoryId] || '기타';
}
