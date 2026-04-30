import { NextRequest, NextResponse } from 'next/server';

// REFACTORED_BY_MERLIN_HUB: 프로필 SSOT는 Hub로 이관
// 이 라우트는 기존 프론트 호환을 위한 경량 응답만 유지

function nicknameFromEmail(email?: string | null): string {
  if (!email) return '사용자';
  return (email.split('@')[0] || '사용자').trim() || '사용자';
}

export async function PUT(request: NextRequest) {
  try {
    const { id, nickname, profileImage, email } = await request.json();

    if (!id && !email) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
    }

    const resolvedId = typeof id === 'string' && id.length > 0 ? id : (typeof email === 'string' ? email : '');
    const resolvedEmail = typeof email === 'string' && email.length > 0 ? email : null;
    const resolvedNickname = typeof nickname === 'string' && nickname.length > 0
      ? nickname
      : nicknameFromEmail(resolvedEmail);

    return NextResponse.json({
      success: true,
      user: {
        id: resolvedId,
        email: resolvedEmail,
        nickname: resolvedNickname,
        image: typeof profileImage === 'string' && profileImage.length > 0 ? profileImage : null,
      },
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

    const resolvedId = id || email || '';
    const resolvedEmail = email || null;

    return NextResponse.json({
      success: true,
      user: {
        id: resolvedId,
        email: resolvedEmail,
        nickname: nicknameFromEmail(resolvedEmail),
        image: null,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
