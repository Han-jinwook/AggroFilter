import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email, channelName, channelId, channelThumbnail, isEntered, categoryName } = await request.json();

    if (!email || !channelName || isEntered === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const statusIcon = isEntered ? '🎉' : '📉';
    const statusText = isEntered ? '진입' : '탈락';
    const statusColor = isEntered ? '#10b981' : '#f59e0b';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resultUrl = channelId
      ? `${baseUrl}/channel/${channelId}`
      : `${baseUrl}/p-ranking${categoryName ? `?category=${categoryName}` : ''}`;

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS t_notifications (
          f_id BIGSERIAL PRIMARY KEY,
          f_user_id TEXT NOT NULL,
          f_type TEXT NOT NULL,
          f_message TEXT NOT NULL,
          f_link TEXT,
          f_is_read BOOLEAN DEFAULT FALSE,
          f_created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON t_notifications (f_user_id, f_is_read);`
      );
      await client.query(
        `INSERT INTO t_notifications (f_user_id, f_type, f_message, f_link, f_is_read, f_email_sent, f_email_data, f_created_at)
         VALUES ($1, $2, $3, $4, FALSE, FALSE, $5, NOW())`,
        [
          email,
          'top10_change',
          `${channelName} 채널이 상위 10%에 ${statusText}했습니다`,
          channelId ? `/channel/${channelId}` : `/p-ranking${categoryName ? `?category=${categoryName}` : ''}`,
          JSON.stringify({ channelName, channelId, channelThumbnail, isEntered, categoryName }),
        ]
      );
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: 'Notification saved (email will be sent in batch)' });

  } catch (error) {
    console.error('Send TOP 10 Change Notification Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
