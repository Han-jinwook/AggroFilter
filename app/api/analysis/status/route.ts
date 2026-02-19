import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId } from '@/lib/youtube';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const videoId = url ? extractVideoId(url) : searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId or url is required' }, { status: 400, headers: corsHeaders });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT f_id, f_reliability_score 
        FROM t_analyses 
        WHERE f_video_id = $1 AND f_created_at > NOW() - INTERVAL '5 minutes'
        ORDER BY f_created_at DESC 
        LIMIT 1
      `, [videoId]);

      if (result.rows.length > 0) {
        return NextResponse.json({
          status: 'completed',
          analysisId: result.rows[0].f_id,
        }, { headers: corsHeaders });
      }

      return NextResponse.json({
        status: 'pending',
      }, { headers: corsHeaders });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Analysis status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
