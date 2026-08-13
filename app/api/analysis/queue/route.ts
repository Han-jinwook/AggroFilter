import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { extractVideoId } from '@/lib/youtube';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// 허브 서버 토큰 검증 헬퍼
async function verifyHubToken(token: string): Promise<string | null> {
  try {
    const hubUrl = process.env.MERLIN_HUB_URL || 'https://os.sundreamer.app';
    console.log(`[Queue API] 검증 요청: ${hubUrl}/api/auth/me`);
    const res = await fetch(`${hubUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      console.warn(`[Queue API] 토큰 검증 실패: Status ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.success && data.user) {
      return data.user.userId || data.user.id || null;
    }
  } catch (err) {
    console.error('[Queue API] verifyHubToken error:', err);
  }
  return null;
}

// 통합 유저 ID 확보 함수
async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1. Authorization 헤더 검사
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      const hubUserId = await verifyHubToken(token);
      if (hubUserId) return hubUserId;
    }
  }

  // 2. Supabase Auth (쿠키) 검사
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (err) {
    console.warn('[Queue API] Supabase getUser error:', err);
  }

  return null;
}

// 1. 대기열 리스트 조회 (GET)
export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(req.url);
    const pendingOnly = searchParams.get('pendingOnly') === 'true';

    const dbClient = await pool.connect();
    try {
      if (pendingOnly) {
        // 확장팩 폴링용: 유저의 가장 오래 대기 중인 예약 1건 반환
        const res = await dbClient.query(`
          SELECT f_id, f_video_url, f_video_id, f_status 
          FROM t_analysis_queue 
          WHERE f_user_id = $1 AND f_status = 'pending' 
          ORDER BY f_created_at ASC 
          LIMIT 1
        `, [userId]);

        return NextResponse.json({
          success: true,
          queue: res.rows.length > 0 ? res.rows[0] : null
        }, { headers: corsHeaders });
      } else {
        // 보관함(Library) 뷰용: 전체 내역 조회
        const res = await dbClient.query(`
          SELECT f_id, f_video_url, f_video_id, f_status, f_created_at 
          FROM t_analysis_queue 
          WHERE f_user_id = $1 
          ORDER BY f_created_at DESC
        `, [userId]);

        return NextResponse.json({
          success: true,
          list: res.rows
        }, { headers: corsHeaders });
      }
    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    console.error('[Queue GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500, headers: corsHeaders });
  }
}

// 2. 예약 등록 (POST)
export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    // 예약 기능은 로그인 유저에게만 매핑 가능
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401, headers: corsHeaders });
    }

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL 파라미터가 필요합니다.' }, { status: 400, headers: corsHeaders });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ success: false, error: '유효하지 않은 유튜브 URL입니다.' }, { status: 400, headers: corsHeaders });
    }

    const dbClient = await pool.connect();
    try {
      // 1. 이미 동일한 비디오가 pending 또는 processing 인지 검사 (중복 방지)
      const checkRes = await dbClient.query(`
        SELECT f_id, f_status 
        FROM t_analysis_queue 
        WHERE f_user_id = $1 AND f_video_id = $2 AND f_status IN ('pending', 'processing')
      `, [userId, videoId]);

      if (checkRes.rows.length > 0) {
        return NextResponse.json({
          success: true,
          message: '이미 분석 대기열에 존재합니다.',
          queueId: checkRes.rows[0].f_id,
          status: checkRes.rows[0].f_status
        }, { headers: corsHeaders });
      }

      // 2. 신규 대기열 등록
      const insertRes = await dbClient.query(`
        INSERT INTO t_analysis_queue (f_user_id, f_video_url, f_video_id, f_status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING f_id, f_status
      `, [userId, url, videoId]);

      return NextResponse.json({
        success: true,
        message: '대기열에 성공적으로 등록되었습니다.',
        queueId: insertRes.rows[0].f_id,
        status: insertRes.rows[0].f_status
      }, { headers: corsHeaders });

    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    console.error('[Queue POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500, headers: corsHeaders });
  }
}

// 3. 상태 변경 (PATCH)
export async function PATCH(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401, headers: corsHeaders });
    }

    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'id와 status 파라미터가 필요합니다.' }, { status: 400, headers: corsHeaders });
    }

    const allowedStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 상태 값입니다.' }, { status: 400, headers: corsHeaders });
    }

    const dbClient = await pool.connect();
    try {
      // 본인 소유의 대기열 큐만 업데이트 가능
      const updateRes = await dbClient.query(`
        UPDATE t_analysis_queue 
        SET f_status = $1, f_updated_at = NOW() 
        WHERE f_id = $2 AND f_user_id = $3
        RETURNING f_id, f_status
      `, [status, id, userId]);

      if (updateRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: '해당 대기열 항목을 찾을 수 없거나 권한이 없습니다.' }, { status: 404, headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        message: `대기열 상태가 ${status}로 업데이트되었습니다.`,
        queueId: updateRes.rows[0].f_id,
        status: updateRes.rows[0].f_status
      }, { headers: corsHeaders });

    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    console.error('[Queue PATCH Error]:', err);
    return NextResponse.json({ success: false, error: err.message || '서버 오류' }, { status: 500, headers: corsHeaders });
  }
}
