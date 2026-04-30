import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const mockVideos = [
  {
    id: '1',
    date: '25.02.07',
    title: '곧 컴백한다는 지드래곤의 솔로곡',
    channel: '아이돌아카이브',
    channelIcon: '/winding-waterway.png',
    score: 100,
    rank: 1,
    totalRank: 5,
  },
  {
    id: '2',
    date: '25.02.06',
    title: '비트코인은 몇 송 모두에게 자비가 없다',
    channel: '비트코인 차트두우',
    channelIcon: '/bitcoin-concept.png',
    score: 85,
    rank: 2,
    totalRank: 5,
  },
  {
    id: '3',
    date: '25.01.25',
    title: '혹백요리사 에기잘 갈데 꺼더리면 안 된다',
    channel: '백종원 PAIK JONG WON',
    channelIcon: '/diverse-chef-preparing-food.png',
    score: 80,
    rank: 3,
    totalRank: 5,
  },
  {
    id: '4',
    date: '25.01.15',
    title: '"데이터출퇴션, 딥시크 쇼크 대응 산업별 AI기술 총합해 경쟁력 강화',
    channel: '서울경제TV',
    channelIcon: '/news-collage.png',
    score: 75,
    rank: 4,
    totalRank: 5,
  },
  {
    id: '5',
    date: '25.01.10',
    title: '도지코인 [긴급] 이번주 "트기적" 입박했습니다! 정확도 100%...',
    channel: 'FAKE호두',
    channelIcon: '/crypto-digital-landscape.png',
    score: 70,
    rank: 5,
    totalRank: 5,
  },
];

export async function GET() {
  // In the future, this will fetch data from the database.
  return NextResponse.json({ videos: mockVideos });
}
