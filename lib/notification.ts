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
 * - 신뢰도 그레이드 변화 (Red/Yellow/Blue) → send-grade-change
 * - 순위 변동 (10% 이상) → send-ranking-change
 * - TOP 10% 진입/탈락 → send-top10-change
 */
export async function checkRankingChangesAndNotify(categoryId: number) {
  const client = await pool.connect();
  try {
    const tableExistsRes = await client.query(
      `SELECT to_regclass('t_channel_subscriptions') IS NOT NULL AS exists`
    );
    const tableExists = tableExistsRes.rows?.[0]?.exists === true;
    if (!tableExists) return;

    // 1. 현재 랭킹 조회 (해당 카테고리)
    const currentRankings = await client.query(`
      SELECT 
        f_channel_id,
        f_avg_reliability,
        ROW_NUMBER() OVER (ORDER BY f_avg_reliability DESC)::int as current_rank,
        COUNT(*) OVER ()::int as total_count
      FROM t_channel_stats
      WHERE f_official_category_id = $1
      ORDER BY f_avg_reliability DESC
    `, [categoryId]);

    if (currentRankings.rows.length === 0) return;

    const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://aggrofilter.netlify.app';
    const totalChannels = currentRankings.rows[0].total_count;
    const top10PercentThreshold = Math.ceil(totalChannels * 0.1);

    // 2. 구독 중인 채널의 이전 상태와 비교
    for (const row of currentRankings.rows) {
      const { f_channel_id, f_avg_reliability, current_rank } = row;
      const reliabilityScore = Number(f_avg_reliability);
      if (!Number.isFinite(reliabilityScore)) continue;
      const reliabilityScoreInt = Math.round(reliabilityScore);

      const currentGrade = getReliabilityGrade(reliabilityScore);
      const isCurrentTop10Percent = current_rank <= top10PercentThreshold;

      // 구독자 조회 (알림 활성화된 사용자만 + 사용자별 알림 설정)
      const subscribers = await client.query(`
        SELECT 
          s.f_user_id,
          s.f_last_rank,
          s.f_last_reliability_grade,
          s.f_last_reliability_score,
          s.f_last_top10_percent_status,
          u.f_email,
          u.f_nickname,
          c.f_title as channel_name,
          c.f_thumbnail_url as channel_thumbnail,
          COALESCE(u.f_notify_grade_change, TRUE) as notify_grade,
          COALESCE(u.f_notify_ranking_change, TRUE) as notify_ranking,
          COALESCE(u.f_notify_top10_change, TRUE) as notify_top10
        FROM t_channel_subscriptions s
        JOIN t_users u ON s.f_user_id = u.f_email
        JOIN t_channels c ON s.f_channel_id = c.f_channel_id
        WHERE s.f_channel_id = $1 
          AND s.f_notification_enabled = TRUE
      `, [f_channel_id]);

      for (const sub of subscribers.rows) {
        const oldGrade = sub.f_last_reliability_grade;
        const oldRank = sub.f_last_rank;
        const oldTop10PercentStatus = sub.f_last_top10_percent_status;

        // 그레이드 변화 감지 → send-grade-change
        if (sub.notify_grade && oldGrade && oldGrade !== currentGrade) {
          console.log(`[알림] 그레이드 변화: ${sub.channel_name} (${oldGrade} → ${currentGrade})`);
          
          fetch(`${baseUrl}/api/notification/send-grade-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sub.f_email,
              channelName: sub.channel_name,
              channelId: f_channel_id,
              channelThumbnail: sub.channel_thumbnail,
              oldGrade: oldGrade,
              newGrade: currentGrade,
              categoryName: null
            })
          }).catch(err => {
            console.error('[알림] 그레이드 변화 알림 발송 실패:', err);
          });
        }

        // 순위 변동 감지 (10% 이상 변동) → send-ranking-change
        if (sub.notify_ranking && oldRank && Math.abs(current_rank - oldRank) >= Math.max(1, Math.ceil(totalChannels * 0.1))) {
          console.log(`[알림] 순위 변동: ${sub.channel_name} (${oldRank}위 → ${current_rank}위)`);
          
          fetch(`${baseUrl}/api/notification/send-ranking-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sub.f_email,
              channelName: sub.channel_name,
              channelId: f_channel_id,
              channelThumbnail: sub.channel_thumbnail,
              oldRank: oldRank,
              newRank: current_rank,
              categoryName: null
            })
          }).catch(err => {
            console.error('[알림] 순위 변동 알림 발송 실패:', err);
          });
        }

        // 상위 10% 진입/탈락 감지 → send-top10-change
        if (sub.notify_top10 && oldTop10PercentStatus !== null && oldTop10PercentStatus !== undefined && oldTop10PercentStatus !== isCurrentTop10Percent) {
          console.log(`[알림] 상위 10%: ${sub.channel_name} (${oldTop10PercentStatus ? '탈락' : '진입'})`);
          
          fetch(`${baseUrl}/api/notification/send-top10-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sub.f_email,
              channelName: sub.channel_name,
              channelId: f_channel_id,
              channelThumbnail: sub.channel_thumbnail,
              isEntered: isCurrentTop10Percent,
              categoryName: null
            })
          }).catch(err => {
            console.error('[알림] 상위 10% 변화 알림 발송 실패:', err);
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
      `, [current_rank, currentGrade, reliabilityScoreInt, isCurrentTop10Percent, f_channel_id]);
    }

  } finally {
    client.release();
  }
}
