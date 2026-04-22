import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// REFACTORED_BY_MERLIN_HUB: t_users 프로필 → app_aggro_profiles + Hub family_users 이관 예정
// 현재는 t_users 테이블을 유지하되, family_uid 기반으로 조회

// REFACTORED_BY_MERLIN_HUB: UPSERT — Hub family_uid 유저도 t_users에 프로필 저장 가능
export async function PUT(request: NextRequest) {
  try {
    const { id, nickname, profileImage, email } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const upsertQuery = `
      INSERT INTO t_users (f_id, f_email, f_nickname, f_image, f_created_at, f_updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (f_id) DO UPDATE SET
        f_nickname = COALESCE($3, t_users.f_nickname),
        f_image = COALESCE($4, t_users.f_image),
        f_email = COALESCE($2, t_users.f_email),
        f_updated_at = NOW()
      RETURNING f_id, f_email, f_nickname, f_image
    `;

    const result = await pool.query(upsertQuery, [id, email || null, nickname, profileImage]);

    return NextResponse.json({ 
      success: true, 
      user: {
        id: result.rows[0].f_id,
        email: result.rows[0].f_email,
        nickname: result.rows[0].f_nickname,
        image: result.rows[0].f_image
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (!email && !id) {
      return NextResponse.json({ error: 'Email or ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      id
        ? 'SELECT f_id, f_email, f_nickname, f_image FROM t_users WHERE f_id = $1'
        : 'SELECT f_id, f_email, f_nickname, f_image FROM t_users WHERE f_email = $1',
      [id || email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: result.rows[0].f_id,
        email: result.rows[0].f_email,
        nickname: result.rows[0].f_nickname,
        image: result.rows[0].f_image
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
