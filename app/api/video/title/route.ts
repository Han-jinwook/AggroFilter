import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const analysis = await prisma.t_analyses.findFirst({
      where: { f_video_id: videoId },
      select: { f_title: true },
      orderBy: { f_created_at: 'desc' }
    });

    if (analysis && analysis.f_title) {
      return NextResponse.json({ title: analysis.f_title });
    }

    return NextResponse.json({ title: null });
  } catch (err) {
    console.error('[VideoTitleAPI] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
