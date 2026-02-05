import { pool } from './db';

/**
 * 신뢰도 점수를 그레이드로 변환
 */
function getReliabilityGrade(score: number): string {
  if (score >= 70) return 'Blue';
  if (score >= 40) return 'Yellow';
  return 'Red';
}

/**
 * 채널 구독 자동 등록
 * 사용자가 영상을 분석하면 해당 채널을 자동으로 구독 처리
 */
export async function subscribeChannelAuto(userId: string, channelId: string) {
  const client = await pool.connect();
  try {
    const tableExistsRes = await client.query(
      `SELECT to_regclass('t_channel_subscriptions') IS NOT NULL AS exists`
    );
    const tableExists = tableExistsRes.rows?.[0]?.exists === true;
    if (!tableExists) return;

    await client.query(`ALTER TABLE t_channel_subscriptions ADD COLUMN IF NOT EXISTS f_is_owner BOOLEAN DEFAULT FALSE`);

    await client.query(`
      INSERT INTO t_channel_subscriptions (f_user_id, f_channel_id, f_subscribed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (f_user_id, f_channel_id) DO NOTHING
    `, [userId, channelId]);
  } finally {
    client.release();
  }
}

/**
 * 채널 랭킹 변동 감지 및 알림 발송
 * - 신뢰도 그레이드 변화 (Red/Yellow/Blue)
 * - TOP 10 진입/탈락
 */
export async function checkRankingChangesAndNotify(categoryId: number) {
  const client = await pool.connect();
  try {
    const tableExistsRes = await client.query(
      `SELECT to_regclass('t_channel_subscriptions') IS NOT NULL AS exists`
    );
    const tableExists = tableExistsRes.rows?.[0]?.exists === true;
    if (!tableExists) return;

    // Ensure contact email column exists for future B2B features
    await client.query(`ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_contact_email TEXT`);

    // 1. 현재 랭킹 조회 (해당 카테고리)
    const currentRankings = await client.query(`
      SELECT 
        f_channel_id,
        f_avg_reliability,
        ROW_NUMBER() OVER (ORDER BY f_avg_reliability DESC) as current_rank,
        COUNT(*) OVER () as total_count
      FROM t_channel_stats
      WHERE f_official_category_id = $1
      ORDER BY f_avg_reliability DESC
    `, [categoryId]);

    if (currentRankings.rows.length === 0) return;

    const totalChannels = currentRankings.rows[0].total_count;
    const top10PercentThreshold = Math.ceil(totalChannels * 0.1);

    // 2. 구독 중인 채널의 이전 상태와 비교
    for (const row of currentRankings.rows) {
      const { f_channel_id, f_avg_reliability, current_rank } = row;
      const currentGrade = getReliabilityGrade(f_avg_reliability);
      const isCurrentTop10Percent = current_rank <= top10PercentThreshold;

      // 구독자 조회 (알림 활성화된 사용자만)
      const subscribers = await client.query(`
        SELECT 
          s.f_user_id,
          s.f_last_rank,
          s.f_last_reliability_grade,
          s.f_last_reliability_score,
          s.f_last_top10_percent_status,
          u.f_email,
          u.f_nickname,
          COALESCE(to_jsonb(c)->>'f_name', to_jsonb(c)->>'f_title') as channel_name
        FROM t_channel_subscriptions s
        JOIN t_users u ON s.f_user_id = u.f_email
        JOIN t_channels c ON s.f_channel_id = COALESCE(to_jsonb(c)->>'f_channel_id', to_jsonb(c)->>'f_id')
        WHERE s.f_channel_id = $1 
          AND s.f_notification_enabled = TRUE
      `, [f_channel_id]);

      for (const sub of subscribers.rows) {
        const oldGrade = sub.f_last_reliability_grade;
        const oldRank = sub.f_last_rank;
        const oldTop10PercentStatus = sub.f_last_top10_percent_status;

        // 그레이드 변화 감지
        if (oldGrade && oldGrade !== currentGrade) {
          console.log(`그레이드 변화 감지: ${sub.channel_name} (${oldGrade} → ${currentGrade})`);
          
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notification/send-ranking-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sub.f_email,
              channelName: sub.channel_name,
              oldRank: oldRank,
              categoryName: null // TODO: 카테고리 이름 매핑 추가
            })
          }).catch(err => {
            console.error('랭킹 변동 알림 발송 실패:', err);
          });
        }

        // 상위 10% 진입/탈락 감지
        if (oldTop10PercentStatus !== null && oldTop10PercentStatus !== isCurrentTop10Percent) {
          console.log(`상위 10% 변화 감지: ${sub.channel_name} (${oldTop10PercentStatus ? '진입' : '탈락'} → ${isCurrentTop10Percent ? '진입' : '탈락'})`);
          
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notification/send-top10-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sub.f_email,
              channelName: sub.channel_name,
              isEntered: isCurrentTop10Percent,
              categoryName: null // TODO: 카테고리 이름 매핑 추가
            })
          }).catch(err => {
            console.error('상위 10% 변화 알림 발송 실패:', err);
          });
        }
      }

      // 3. 현재 상태 업데이트
      await client.query(`
        UPDATE t_channel_subscriptions
        SET 
          f_last_rank = $1, 
          f_last_reliability_grade = $2,
          f_last_reliability_score = $3,
          f_last_top10_percent_status = $4,
          f_last_rank_checked_at = NOW()
        WHERE f_channel_id = $5
      `, [current_rank, currentGrade, f_avg_reliability, isCurrentTop10Percent, f_channel_id]);
    }

  } finally {
    client.release();
  }
}
