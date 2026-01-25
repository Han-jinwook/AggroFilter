import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, channelName, oldGrade, newGrade, categoryName } = await request.json();

    if (!email || !channelName || !oldGrade || !newGrade) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gradeInfo: Record<string, { color: string; label: string; icon: string }> = {
      'Blue': { color: '#3b82f6', label: '신뢰 (Blue Zone)', icon: '🔵' },
      'Yellow': { color: '#f59e0b', label: '주의 (Yellow Zone)', icon: '🟡' },
      'Red': { color: '#ef4444', label: '경고 (Red Zone)', icon: '🔴' }
    };

    const oldGradeInfo = gradeInfo[oldGrade] || gradeInfo['Yellow'];
    const newGradeInfo = gradeInfo[newGrade] || gradeInfo['Yellow'];
    
    const resultUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/p-ranking${categoryName ? `?category=${categoryName}` : ''}`;

    const { data, error } = await resend.emails.send({
      from: 'AggroFilter <onboarding@resend.dev>',
      to: [email],
      subject: `[AggroFilter] ${channelName} 채널의 신뢰도 등급이 변경되었습니다`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fc;">
          <div style="background-color: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #6366f1; font-size: 28px; margin: 0;">AggroFilter</h1>
              <p style="color: #64748b; font-size: 14px; margin-top: 8px;">관심 채널 신뢰도 등급 변경 알림</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
              <h2 style="color: white; font-size: 20px; margin: 0; line-height: 1.4;">${channelName}</h2>
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 8px;">신뢰도 등급에 변화가 생겼습니다</p>
            </div>

            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0;">기존 등급</p>
              <div style="display: inline-block; padding: 12px 24px; background-color: white; border-radius: 12px; border: 2px solid ${oldGradeInfo.color}; margin-bottom: 16px;">
                <span style="font-size: 24px; margin-right: 8px;">${oldGradeInfo.icon}</span>
                <span style="font-size: 18px; font-weight: bold; color: ${oldGradeInfo.color};">${oldGradeInfo.label}</span>
              </div>
              <p style="color: #94a3b8; font-size: 14px; margin: 16px 0 0 0;">자세한 변화 내용은 아래 버튼을 클릭하여 확인하세요</p>
            </div>

            ${categoryName ? `
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; padding: 8px 16px; background-color: #f1f5f9; border-radius: 20px; color: #475569; font-size: 14px;">
                📊 ${categoryName} 카테고리
              </span>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 32px;">
              <a href="${resultUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                전체 랭킹 확인하기
              </a>
            </div>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                이 알림은 구독하신 채널의 신뢰도 등급이 변경되어 발송되었습니다.<br>
                알림 설정은 마이페이지에서 변경하실 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Notification sent' });

  } catch (error) {
    console.error('Send Grade Change Notification Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
