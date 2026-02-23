import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15분

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS t_magic_links (
          f_id BIGSERIAL PRIMARY KEY,
          f_email TEXT NOT NULL,
          f_token TEXT NOT NULL UNIQUE,
          f_expires_at TIMESTAMPTZ NOT NULL,
          f_used BOOLEAN DEFAULT FALSE,
          f_created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query('DELETE FROM t_magic_links WHERE f_email = $1', [email]);
      await client.query(
        `INSERT INTO t_magic_links (f_email, f_token, f_expires_at) VALUES ($1, $2, $3)`,
        [email, token, expiresAt]
      );
    } finally {
      client.release();
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aggrofilter.com';
    const magicLink = `${baseUrl}/api/auth/magic-link/callback?token=${token}`;

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'AggroFilter <onboarding@resend.dev>';

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: '[AggroFilter] 로그인 링크',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #2563eb; text-align: center; margin-bottom: 8px;">AggroFilter</h2>
          <p style="color: #475569; text-align: center; margin-bottom: 32px;">아래 버튼을 클릭하면 바로 로그인됩니다.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${magicLink}"
               style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 10px; text-decoration: none;">
              로그인하기
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">이 링크는 15분간 유효합니다. 본인이 요청하지 않았다면 무시하세요.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Send Magic Link Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
