import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin Client for Hub DB (wwopcuitvjldixkyzpzi)
// 래퍼 함수로 만들어 빌드 타임에 실행되지 않도록 방지합니다.
const getSupabase = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

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

    const resolvedNickname = typeof nickname === 'string' && nickname.trim().length > 0 ? nickname.trim() : null;
    const resolvedImage = typeof profileImage === 'string' && profileImage.trim().length > 0 ? profileImage.trim() : null;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (resolvedNickname) updateData.nickname = resolvedNickname;
    if (resolvedImage) updateData.avatar_url = resolvedImage;

    let query = getSupabase().from('family_users').update(updateData);

    const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      query = query.eq('id', id);
    } else if (email) {
      query = query.ilike('email', email);
    } else {
      return NextResponse.json({ error: 'Valid UUID (id) or Email is required' }, { status: 400 });
    }

    const { data: updatedUser, error: updateError } = await query.select().maybeSingle();

    if (updateError) {
      console.error('Hub DB profile update failed:', updateError.message);
      return NextResponse.json({ error: `Hub DB update failed: ${updateError.message}` }, { status: 500 });
    }

    const finalUser = updatedUser || {
      id: id || '',
      email: email || '',
      nickname: resolvedNickname || nicknameFromEmail(email),
      avatar_url: resolvedImage || ''
    };

    return NextResponse.json({
      success: true,
      user: {
        id: finalUser.id,
        email: finalUser.email,
        nickname: finalUser.nickname,
        image: finalUser.avatar_url || null,
      },
    });
  } catch (error: any) {
    console.error('Profile update API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
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

    let query = getSupabase().from('family_users').select('*');

    const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      query = query.eq('id', id);
    } else if (email) {
      query = query.ilike('email', email);
    } else {
      return NextResponse.json({ error: 'Valid UUID (id) or Email is required for query' }, { status: 400 });
    }

    const { data: user, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error('Hub DB profile fetch failed:', fetchError.message);
      return NextResponse.json({ error: `Hub DB fetch failed: ${fetchError.message}` }, { status: 500 });
    }

    if (!user) {
      // If user not found in Hub DB yet, return basic fallback info
      return NextResponse.json({
        success: true,
        user: {
          id: id || '',
          email: email || '',
          nickname: nicknameFromEmail(email),
          image: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        image: user.avatar_url || null,
      },
    });
  } catch (error: any) {
    console.error('Profile fetch API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 });
  }
}
