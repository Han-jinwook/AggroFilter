import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// 기존 프로젝트 설정과 동일하게 Pool 생성 (환경 변수 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    // pg 클라이언트를 사용하여 t_analyses 테이블에서 제목 조회
    const result = await pool.query(
      'SELECT f_title FROM t_analyses WHERE f_video_id = $1 ORDER BY f_created_at DESC LIMIT 1',
      [videoId]
    );

    if (result.rows.length > 0 && result.rows[0].f_title) {
      return NextResponse.json({ title: result.rows[0].f_title });
    }

    return NextResponse.json({ title: null });
  } catch (err) {
    console.error('[VideoTitleAPI] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
