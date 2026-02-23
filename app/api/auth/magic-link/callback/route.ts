import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aggrofilter.com';

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/?login_error=invalid_token`);
  }

  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT * FROM t_magic_links
      WHERE f_token = $1
        AND f_used = FALSE
        AND f_expires_at > NOW()
      LIMIT 1
    `, [token]);

    if (res.rows.length === 0) {
      return NextResponse.redirect(`${baseUrl}/?login_error=expired_token`);
    }

    const { f_email: email, f_id: linkId } = res.rows[0];

    await client.query('UPDATE t_magic_links SET f_used = TRUE WHERE f_id = $1', [linkId]);

    const userRes = await client.query('SELECT f_id FROM t_users WHERE f_email = $1', [email]);
    let userId: string;
    if (userRes.rows.length === 0) {
      userId = uuidv4();
      await client.query(
        `INSERT INTO t_users (f_id, f_email, f_nickname, f_created_at, f_updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [userId, email, email.split('@')[0]]
      );
    } else {
      userId = userRes.rows[0].f_id;
    }

    const response = NextResponse.redirect(`${baseUrl}/?magic_login=success&email=${encodeURIComponent(email)}&userId=${encodeURIComponent(userId)}`);
    return response;

  } finally {
    client.release();
  }
}
