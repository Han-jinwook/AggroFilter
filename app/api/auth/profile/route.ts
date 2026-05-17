import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    
    const clientId = request.headers.get('x-client-id') || process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
    const clientSecret = request.headers.get('x-client-secret') || process.env.MERLIN_HUB_CLIENT_SECRET || 'merlin-family-secret-key-2026';
    
    headers['x-client-id'] = clientId;
    headers['x-client-secret'] = clientSecret;

    const hubUrl = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'http://localhost:3001';
    
    console.log(`[Proxy PUT] Forwarding profile update to Hub Backend: ${hubUrl}/api/auth/profile`);

    const response = await fetch(`${hubUrl}/api/auth/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Profile Proxy PUT error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
