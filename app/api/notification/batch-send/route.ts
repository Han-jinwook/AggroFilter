import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

// Cron secret to prevent unauthorized access
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

function getNotificationIcon(type: string, emailData: any): string {
  switch (type) {
    case 'grade_change': return '⚠️';
    case 'ranking_change': return '📊';
    case 'top10_change': return emailData?.isEntered ? '🎉' : '📉';
    default: return '🔔';
  }
}

function getNotificationSummary(type: string, emailData: any): string {
  const name = emailData?.channelName || '채널';
  switch (type) {
    case 'grade_change':
      return `${name} — 등급 변경 (${emailData?.oldGrade} → ${emailData?.newGrade})`;
    case 'ranking_change':
      return `${name} — 순위 변동 (기존 ${emailData?.oldRank}위)`;
    case 'top10_change':
      return `${name} — 상위 10% ${emailData?.isEntered ? '진입' : '탈락'}`;
    default:
      return name;
  }
}

function buildDigestHtml(notifications: NotificationRow[], baseUrl: string): string {
  const items = notifications.map(n => {
    const icon = getNotificationIcon(n.f_type, n.f_email_data);
    const summary = getNotificationSummary(n.f_type, n.f_email_data);
    const link = n.f_link ? `${baseUrl}${n.f_link}` : baseUrl;
    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <a href="${link}" style="text-decoration: none; color: inherit; display: block;">
            <span style="font-size: 20px; margin-right: 8px;">${icon}</span>
            <span style="color: #334155; font-size: 14px;">${summary}</span>
          </a>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fc;">
      <div style="background-color: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; font-size: 28px; margin: 0;">AggroFilter</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 8px;">채널 변동 알림 (${notifications.length}건)</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 8px;">🔔</div>
          <p style="color: white; font-size: 16px; font-weight: 600; margin: 0;">구독 채널에 ${notifications.length}건의 변동이 있습니다</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; background-color: #fafbfc; border-radius: 12px; overflow: hidden;">
          ${items}
        </table>

        <div style="text-align: center; margin-top: 28px;">
          <a href="${baseUrl}/p-notification" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
            전체 알림 확인하기
          </a>
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            이 알림은 구독하신 채널의 변동 사항을 모아 발송됩니다.<br>
            알림 설정은 마이페이지에서 변경하실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  `;
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
        SELECT n.f_id, n.f_user_id, n.f_type, n.f_message, n.f_link, n.f_email_data, n.f_created_at
        FROM t_notifications n
        JOIN t_users u ON n.f_user_id = u.f_email
        WHERE n.f_email_sent = FALSE
          AND u.f_email IS NOT NULL
          AND u.f_email LIKE '%@%'
        ORDER BY n.f_user_id, n.f_created_at ASC
      `);

      if (pendingResult.rows.length === 0) {
        return NextResponse.json({ success: true, message: 'No pending notifications', sent: 0 });
      }

      // Group by user
      const userGroups = new Map<string, NotificationRow[]>();
      for (const row of pendingResult.rows) {
        const existing = userGroups.get(row.f_user_id) || [];
        existing.push(row);
        userGroups.set(row.f_user_id, existing);
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      let totalSent = 0;
      let totalFailed = 0;
      const processedIds: number[] = [];

      for (const [userEmail, notifications] of userGroups) {
        try {
          const count = notifications.length;
          const subject = count === 1
            ? `[AggroFilter] ${notifications[0].f_message}`
            : `[AggroFilter] 채널 변동 알림 ${count}건`;

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
