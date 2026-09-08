import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function nicknameFromEmail(email?: string | null): string {
  if (!email) return '사용자';
  return (email.split('@')[0] || '사용자').trim() || '사용자';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (!email && !id) {
      return NextResponse.json({ error: 'Email or ID is required' }, { status: 400 });
    }

    const hubUrl = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';
    const clientId = process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
    const clientSecret = process.env.MERLIN_HUB_CLIENT_SECRET || 'merlin-family-secret-key-2026';

    try {
      const hubRes = await fetch(`${hubUrl}/api/auth/profile?${searchParams.toString()}`, {
        headers: {
          'x-client-id': clientId,
          'x-client-secret': clientSecret,
        },
        cache: 'no-store'
      });
      if (hubRes.ok) {
        const hubData = await hubRes.json();
        return NextResponse.json(hubData);
      }
    } catch (e) {
      console.warn('[Proxy GET] Hub profile fetch error, fallback:', e);
    }

    // Safe fallback
    return NextResponse.json({
      success: true,
      user: {
        id: id || '',
        email: email || '',
        nickname: nicknameFromEmail(email),
        image: null,
      },
    });
  } catch (error: any) {
    console.error('Profile fetch API error:', error);
    return NextResponse.json({
      success: true,
      user: {
        id: '',
        email: '',
        nickname: '사용자',
        image: null,
      },
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const hubUrl = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';
    const clientId = process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
    const clientSecret = process.env.MERLIN_HUB_CLIENT_SECRET || 'merlin-family-secret-key-2026';

    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
    };
    if (authHeader) headers['authorization'] = authHeader;

    const response = await fetch(`${hubUrl}/api/auth/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Profile update API error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

