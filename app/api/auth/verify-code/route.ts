import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // 1. Find the active code for this email
      const res = await client.query(`
        SELECT * FROM t_verification_codes 
        WHERE f_email = $1 
          AND f_code = $2
          AND f_verified = FALSE
          AND f_expires_at > NOW()
        ORDER BY f_created_at DESC
        LIMIT 1
      `, [email, code]);

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
      }

      // 2. Mark as verified (optional, or just delete it)
      // We'll mark it verified so it can't be used again immediately
      await client.query(`
        UPDATE t_verification_codes 
        SET f_verified = TRUE 
        WHERE f_id = $1
      `, [res.rows[0].f_id]);
      
      // 3. Ensure user exists in User table? 
      // Current logic doesn't strictly require a User table row for "analysis" usage 
      // but if you have a users table, you might want to upsert here.
      // For now, we just return success so the frontend logs them in.

      return NextResponse.json({ success: true, message: 'Verified successfully' });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Verify Code Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
