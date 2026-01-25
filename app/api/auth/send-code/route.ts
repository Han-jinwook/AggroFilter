import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

// Initialize Resend with API Key (ensure RESEND_API_KEY is set in .env)
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 2. Set expiration (e.g., 5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const client = await pool.connect();
    
    try {
      // 3. Save to DB (invalidate old codes for this email by inserting new one)
      // We don't delete old ones immediately, but we can just insert a new active code.
      // Or we can delete previous unverified codes for this email to keep it clean.
      await client.query('DELETE FROM t_verification_codes WHERE f_email = $1', [email]);
      
      await client.query(`
        INSERT INTO t_verification_codes (f_email, f_code, f_expires_at)
        VALUES ($1, $2, $3)
      `, [email, code, expiresAt]);
      
    } finally {
      client.release();
    }

    // 4. Send Email via Resend
    const { data, error } = await resend.emails.send({
      from: 'AggroFilter <onboarding@resend.dev>', // User might need to change this if they have a domain
      to: [email],
      subject: '[AggroFilter] 로그인 인증코드',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2563eb; text-align: center;">AggroFilter</h2>
          <p style="color: #475569; text-align: center;">아래 인증코드를 입력하여 로그인을 완료하세요.</p>
          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">이 코드는 5분간 유효합니다.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      
      // 개발 환경에서는 콘솔에 코드 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('\n========================================');
        console.log(`🔐 인증 코드 (${email}): ${code}`);
        console.log('========================================\n');
        return NextResponse.json({ success: true, message: 'Code sent (dev mode - check console)' });
      }
      
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Code sent' });

  } catch (error) {
    console.error('Send Code Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
