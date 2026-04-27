import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId } from '@/lib/youtube';

export const runtime = 'nodejs';
const ACTIVE_ANALYSIS_WINDOW_MS = 5 * 60 * 1000;

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
    const videoId = (url ? extractVideoId(url) : searchParams.get('videoId'))?.trim();

    if (!videoId) {
      return NextResponse.json({ error: 'videoId or url is required' }, { status: 400, headers: corsHeaders });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT f_id, f_reliability_score, f_is_valid, f_processing_stage, f_last_action_at, f_created_at
        FROM t_analyses 
        WHERE f_video_id = $1 AND f_created_at > NOW() - INTERVAL '30 minutes'
        ORDER BY f_created_at DESC 
        LIMIT 1
      `, [videoId]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const isCompleted =
          row.f_processing_stage === 'completed' ||
          (row.f_processing_stage == null && row.f_reliability_score !== null);

        if (isCompleted) {
          return NextResponse.json({
            status: 'completed',
            analysisId: row.f_id,
          }, { headers: corsHeaders });
        }

        const activeAt = row.f_last_action_at || row.f_created_at;
        const activeAtMs = activeAt ? new Date(activeAt).getTime() : 0;
        const isFreshInFlight = Number.isFinite(activeAtMs) && Date.now() - activeAtMs <= ACTIVE_ANALYSIS_WINDOW_MS;

        if (row.f_processing_stage === 'speed_ready' && isFreshInFlight) {
          return NextResponse.json({
            status: 'speed_ready',
            analysisId: row.f_id,
          }, { headers: corsHeaders });
        }

        if (row.f_processing_stage === 'pending' && isFreshInFlight) {
          return NextResponse.json({
            status: 'pending',
            analysisId: row.f_id,
          }, { headers: corsHeaders });
        }

        return NextResponse.json({
          status: 'pending',
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
