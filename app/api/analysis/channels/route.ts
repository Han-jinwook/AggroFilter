import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const mockChannels = [
  {
    id: '1',
    date: '25.02.18',
    channelName: '백종원 PAIK JONG WON',
    topic: '요리',
    videoCount: 3,
    rankScore: 85,
  },
  {
    id: '2',
    date: '25.02.18',
    channelName: 'Soothing Ghibli Piano',
    topic: '일본 애니',
    videoCount: 6,
    rankScore: 92,
  },
  {
    id: '3',
    date: '25.02.18',
    channelName: 'The Everyday Recipe',
    topic: '코리 블로그',
    videoCount: 5,
    rankScore: 78,
  },
  {
    id: '4',
    date: '25.02.15',
    channelName: '또마미마 Yummy Yammy',
    topic: '맛집 콘스트',
    videoCount: 7,
    rankScore: 88,
  },
  {
    id: '5',
    date: '25.02.14',
    channelName: 'FOOD★STAR フードスター',
    topic: '맛집 콘스트',
    videoCount: 3,
    rankScore: 81,
  },
  {
    id: '6',
    date: '25.02.13',
    channelName: '甘党スイーツ amaito sweets',
    topic: '디저트 제작',
    videoCount: 4,
    rankScore: 90,
  },
  {
    id: '7',
    date: '25.02.12',
    channelName: 'EBS 세계테마기행-메코마마? 괴만절!',
    topic: '먹여둘 일상',
    videoCount: 10,
    rankScore: 95,
  },
];

export async function GET() {
  // In the future, this will fetch data from the database.
  return NextResponse.json({ channels: mockChannels });
}
