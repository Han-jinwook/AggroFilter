import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Vercel Cron Job을 위해 필요

async function createMorningReport(client: any, channelId: string, channelName: string, lostCustomers: number) {
  // Find the channel owner
  const ownerRes = await client.query(
    'SELECT f_user_id FROM t_channel_subscriptions WHERE f_channel_id = $1 AND f_is_owner = TRUE LIMIT 1',
    [channelId]
  );

  if (ownerRes.rows.length === 0) {
    console.log(`'${channelName}' 채널의 소유자를 찾을 수 없어 모닝 리포트를 건너뜁니다.`);
    return; // No owner found
  }

  const ownerId = ownerRes.rows[0].f_user_id;
  const message = `대표님, 어제 하루 동안 **${lostCustomers}명**의 잠재 고객이 [${channelName}] 채널의 콘텐츠를 신뢰하지 못했습니다. 어그로필터에서 평판을 관리하고 고객 이탈을 방지하세요.`
  const link = `/p-my-page?tab=recheck`; // 재검수 페이지로 유도

  await client.query(
    `INSERT INTO t_notifications (f_user_id, f_type, f_message, f_link, f_is_read, f_created_at)
     VALUES ($1, 'morning_report', $2, $3, FALSE, NOW())`,
    [ownerId, message, link]
  );

}

export async function GET() {
  console.log('모닝 리포트 생성을 시작합니다...');
  const client = await pool.connect();
  try {
    // 1. 어제 하루 동안 생성된, 신뢰도 69점 이하의 분석 결과를 조회
    const reportsRes = await client.query(`
      SELECT
        a.f_channel_id,
        COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as channel_name,
        COUNT(DISTINCT a.f_user_id) as lost_customers -- 분석을 요청한 유저 수로 '잠재 이탈 고객'을 추정
      FROM t_analyses a
      JOIN t_channels c ON a.f_channel_id = COALESCE(to_jsonb(c)->>'f_id', to_jsonb(c)->>'f_channel_id')
      WHERE a.f_created_at >= NOW() - INTERVAL '1 day'
        AND a.f_reliability_score <= 69
      GROUP BY a.f_channel_id, COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title')
      HAVING COUNT(DISTINCT a.f_user_id) > 0;
    `);

    if (reportsRes.rows.length === 0) {
      console.log('모닝 리포트 대상 채널이 없습니다.');
      return NextResponse.json({ message: 'No reports to send.' });
    }

    // 2. 각 채널에 대한 리포트 생성
    for (const report of reportsRes.rows) {
      await createMorningReport(client, report.f_channel_id, report.channel_name, report.lost_customers);
      console.log(`'${report.channel_name}' 채널에 대한 모닝 리포트 생성 완료.`);
    }

    return NextResponse.json({ message: `${reportsRes.rows.length}개의 채널에 대한 모닝 리포트가 성공적으로 생성되었습니다.` });

  } catch (error) {
    console.error('모닝 리포트 생성 중 오류 발생:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
