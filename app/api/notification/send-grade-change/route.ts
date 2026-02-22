import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId, channelName, channelId, channelThumbnail, oldGrade, newGrade, categoryName } = await request.json();

    if (!userId || !channelName || !oldGrade || !newGrade) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gradeInfo: Record<string, { color: string; label: string; icon: string }> = {
      'Blue': { color: '#3b82f6', label: '신뢰 (Blue Zone)', icon: '🔵' },
      'Yellow': { color: '#f59e0b', label: '주의 (Yellow Zone)', icon: '🟡' },
      'Red': { color: '#ef4444', label: '경고 (Red Zone)', icon: '🔴' }
    };

    const oldGradeInfo = gradeInfo[oldGrade] || gradeInfo['Yellow'];
    const newGradeInfo = gradeInfo[newGrade] || gradeInfo['Yellow'];
    
    const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://aggrofilter.netlify.app';
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
        `INSERT INTO t_notifications (f_user_id, f_type, f_message, f_link, f_is_read, f_created_at)
         VALUES ($1, $2, $3, $4, FALSE, NOW())`,
        [
          userId,
          'grade_change',
          `${channelName} 채널의 신뢰도 등급이 변경되었습니다 (${oldGrade} → ${newGrade})`,
          channelId ? `/channel/${channelId}` : `/p-ranking${categoryName ? `?category=${categoryName}` : ''}`
        ]
      );
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: 'Notification saved (email will be sent in batch)' });

  } catch (error) {
    console.error('Send Grade Change Notification Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
