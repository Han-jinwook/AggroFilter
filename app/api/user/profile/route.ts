import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const { email, nickname, profileImage } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const updateQuery = `
      UPDATE t_users 
      SET 
        f_nickname = COALESCE($1, f_nickname),
        f_image = COALESCE($2, f_image),
        f_updated_at = NOW()
      WHERE f_email = $3
      RETURNING f_id, f_email, f_nickname, f_image
    `;

    const result = await pool.query(updateQuery, [nickname, profileImage, email]);

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
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT f_id, f_email, f_nickname, f_image FROM t_users WHERE f_email = $1',
      [email]
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
