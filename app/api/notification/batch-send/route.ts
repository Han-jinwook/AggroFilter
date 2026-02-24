import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

const CRON_SECRET = process.env.CRON_SECRET || '';

interface NotificationRow {
  f_id: number;
  f_user_id: string;
  f_type: string;
  f_message: string;
  f_link: string | null;
  f_email_data: any;
  f_created_at: string;
}

const GRADE_INFO: Record<string, { color: string; label: string; icon: string }> = {
  'Green': { color: '#10b981', label: 'Green', icon: '🟢' },
  'Yellow': { color: '#f59e0b', label: 'Yellow', icon: '🟡' },
  'Red': { color: '#ef4444', label: 'Red', icon: '🔴' },
};

function buildChannelCard(data: any, link: string, content: string): string {
  const name = data?.channelName || '알 수 없는 채널';
  const thumb = data?.channelThumbnail;
  const thumbHtml = thumb
    ? `<img src="${thumb}" alt="${name}" width="48" height="48" style="border-radius: 50%; margin-right: 12px; vertical-align: middle; object-fit: cover;" />`
    : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #e2e8f0; margin-right: 12px; display: inline-block; vertical-align: middle; text-align: center; line-height: 48px; font-size: 20px; color: #94a3b8;">📺</div>`;

  return `
    <a href="${link}" style="text-decoration: none; color: inherit; display: block; padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="60" style="vertical-align: top;">${thumbHtml}</td>
        <td style="vertical-align: middle;">
          <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 15px; color: #1e293b;">${name}</p>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">${content}</p>
        </td>
      </tr></table>
    </a>`;
}

function buildSection(title: string, icon: string, color: string, cards: string[]): string {
  if (cards.length === 0) return '';
  return `
    <div style="margin-bottom: 24px;">
      <div style="padding: 10px 16px; background-color: ${color}; border-radius: 10px 10px 0 0;">
        <span style="font-size: 16px; margin-right: 6px;">${icon}</span>
        <span style="font-size: 14px; font-weight: 700; color: white;">${title} (${cards.length}건)</span>
      </div>
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; overflow: hidden;">
        ${cards.join('')}
      </div>
    </div>`;
}

function buildDigestHtml(notifications: NotificationRow[], baseUrl: string): string {
  const gradeCards: string[] = [];
  const rankCards: string[] = [];
  const top10Cards: string[] = [];

  for (const n of notifications) {
    const d = n.f_email_data || {};
    const link = n.f_link ? `${baseUrl}${n.f_link}` : `${baseUrl}/p-ranking`;

    switch (n.f_type) {
      case 'grade_change': {
        const oldG = GRADE_INFO[d.oldGrade] || GRADE_INFO['Yellow'];
        const newG = GRADE_INFO[d.newGrade] || GRADE_INFO['Yellow'];
        gradeCards.push(buildChannelCard(d, link,
          `신뢰도 등급 변경: ${oldG.icon} ${oldG.label} → ${newG.icon} ${newG.label}`
        ));
        break;
      }
      case 'ranking_change': {
        const oldR = d.oldRank ?? '?';
        const newR = d.newRank ?? '?';
        const diff = (d.oldRank && d.newRank) ? d.newRank - d.oldRank : 0;
        const arrow = diff < 0 ? `🔺 ${Math.abs(diff)}단계 상승` : diff > 0 ? `🔻 ${diff}단계 하락` : '변동';
        rankCards.push(buildChannelCard(d, link,
          `${oldR}위 → ${newR}위 (${arrow})`
        ));
        break;
      }
      case 'top10_change': {
        const entered = d.isEntered;
        top10Cards.push(buildChannelCard(d, link,
          entered ? '🎉 상위 10%에 진입했습니다!' : '📉 상위 10%에서 이탈했습니다'
        ));
        break;
      }
    }
  }

  const sections = [
    buildSection('신뢰도 등급 변경', '⚠️', '#f59e0b', gradeCards),
    buildSection('순위 변동', '📊', '#6366f1', rankCards),
    buildSection('상위 10% 변동', '🏆', '#10b981', top10Cards),
  ].filter(Boolean).join('');

  const channelNames = [...new Set(notifications.map(n => n.f_email_data?.channelName).filter(Boolean))];
  const channelPreview = channelNames.length <= 2
    ? channelNames.join(', ')
    : `${channelNames[0]} 외 ${channelNames.length - 1}개 채널`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fc;">
      <div style="background-color: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; font-size: 28px; margin: 0;">AggroFilter</h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 28px; text-align: center;">
          <div style="font-size: 44px; margin-bottom: 10px;">�</div>
          <h2 style="color: white; font-size: 18px; margin: 0 0 6px 0; font-weight: 700;">구독 채널에 큰 변동이 감지되었습니다!</h2>
          <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${channelPreview} · 총 ${notifications.length}건</p>
        </div>

        ${sections}

        <div style="text-align: center; margin-top: 28px;">
          <a href="${baseUrl}/p-notification" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
            전체 알림 확인하기
          </a>
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            이 알림은 구독하신 채널의 변동 사항을 하루 2회(12:10, 19:10) 모아 발송됩니다.<br>
            알림 설정은 설정 페이지에서 변경하실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildSubject(notifications: NotificationRow[]): string {
  const channelNames = [...new Set(notifications.map(n => n.f_email_data?.channelName).filter(Boolean))];
  const count = notifications.length;

  if (count === 1) {
    const n = notifications[0];
    const name = n.f_email_data?.channelName || '구독 채널';
    switch (n.f_type) {
      case 'grade_change':
        return `🚨 ${name}의 신뢰도 등급이 바뀌었어요!`;
      case 'ranking_change':
        return `📊 ${name}의 순위가 크게 변동됐어요!`;
      case 'top10_change':
        return n.f_email_data?.isEntered
          ? `🎉 ${name}이(가) 상위 10%에 진입!`
          : `📉 ${name}이(가) 상위 10%에서 이탈했어요`;
      default:
        return `🔔 ${name}에 변동이 생겼어요`;
    }
  }

  const preview = channelNames.length <= 2
    ? channelNames.join(', ')
    : `${channelNames[0]} 외 ${channelNames.length - 1}개 채널`;

  return `🚨 구독 채널 ${count}건 변동 — ${preview}`;
}

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const { secret } = await request.json().catch(() => ({ secret: '' }));
    if (CRON_SECRET && secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      // Ensure columns exist (migration safety)
      await client.query(`ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS f_email_sent BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS f_email_data JSONB`);

      // Fetch all unsent notifications grouped by user
      const pendingResult = await client.query<NotificationRow>(`
        SELECT n.f_id, n.f_user_id, n.f_type, n.f_message, n.f_link, n.f_email_data, n.f_created_at, u.f_email as user_email
        FROM t_notifications n
        JOIN t_users u ON n.f_user_id = u.f_id
        WHERE n.f_email_sent = FALSE
          AND u.f_email IS NOT NULL
          AND u.f_email LIKE '%@%'
        ORDER BY n.f_user_id, n.f_created_at ASC
      `);

      if (pendingResult.rows.length === 0) {
        return NextResponse.json({ success: true, message: 'No pending notifications', sent: 0 });
      }

      // Group by user (using email for sending)
      const userGroups = new Map<string, NotificationRow[]>();
      for (const row of pendingResult.rows) {
        const email = (row as any).user_email;
        const existing = userGroups.get(email) || [];
        existing.push(row);
        userGroups.set(email, existing);
      }

      const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://aggrofilter.netlify.app';
      let totalSent = 0;
      let totalFailed = 0;
      const processedIds: number[] = [];

      for (const [userEmail, notifications] of userGroups) {
        try {
          const subject = buildSubject(notifications);

          const html = buildDigestHtml(notifications, baseUrl);

          const { error } = await resend.emails.send({
            from: 'AggroFilter <onboarding@resend.dev>',
            to: [userEmail],
            subject,
            html,
          });

          if (error) {
            console.error(`[batch-send] Email failed for ${userEmail}:`, error);
            totalFailed++;
          } else {
            totalSent++;
          }

          // Mark as sent regardless (to avoid re-sending on next batch)
          processedIds.push(...notifications.map(n => n.f_id));
        } catch (err) {
          console.error(`[batch-send] Error processing ${userEmail}:`, err);
          totalFailed++;
          // Still mark as processed to avoid infinite retry
          processedIds.push(...notifications.map(n => n.f_id));
        }
      }

      // Bulk update all processed notifications
      if (processedIds.length > 0) {
        await client.query(
          `UPDATE t_notifications SET f_email_sent = TRUE WHERE f_id = ANY($1)`,
          [processedIds]
        );
      }

      console.log(`[batch-send] Completed: ${totalSent} sent, ${totalFailed} failed, ${processedIds.length} processed`);

      return NextResponse.json({
        success: true,
        sent: totalSent,
        failed: totalFailed,
        processed: processedIds.length,
        users: userGroups.size,
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[batch-send] Critical error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
