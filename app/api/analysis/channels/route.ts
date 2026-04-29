import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const mockChannels = [
  {
    id: '1',
    date: '25.02.18',
    channelName: '백종??PAIK JONG WON',
    topic: '?�리',
    videoCount: 3,
    rankScore: 85,
  },
  {
    id: '2',
    date: '25.02.18',
    channelName: 'Soothing Ghibli Piano',
    topic: '?�본 ?�니',
    videoCount: 6,
    rankScore: 92,
  },
  {
    id: '3',
    date: '25.02.18',
    channelName: 'The Everyday Recipe',
    topic: '코리 블로�?,
    videoCount: 5,
    rankScore: 78,
  },
  {
    id: '4',
    date: '25.02.15',
    channelName: '?�마미마 Yummy Yammy',
    topic: '맛집 콘스??,
    videoCount: 7,
    rankScore: 88,
  },
  {
    id: '5',
    date: '25.02.14',
    channelName: 'FOOD?�STAR ?�ー?�ス?�ー',
    topic: '맛집 콘스??,
    videoCount: 3,
    rankScore: 81,
  },
  {
    id: '6',
    date: '25.02.13',
    channelName: '?�党?�イ?�ツ amaito sweets',
    topic: '?��????�작',
    videoCount: 4,
    rankScore: 90,
  },
  {
    id: '7',
    date: '25.02.12',
    channelName: 'EBS ?�계?�마기행-메코마마? 괴만??',
    topic: '먹여???�상',
    videoCount: 10,
    rankScore: 95,
  },
];

export async function GET() {
  // In the future, this will fetch data from the database.
  return NextResponse.json({ channels: mockChannels });
}
