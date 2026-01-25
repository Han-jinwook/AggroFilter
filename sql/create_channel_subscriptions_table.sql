-- 채널 구독 테이블 생성
-- 사용자가 분석한 채널을 자동으로 구독하고, 랭킹 변동 시 알림을 발송하기 위한 테이블

CREATE TABLE IF NOT EXISTS t_channel_subscriptions (
    f_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    f_user_id UUID NOT NULL REFERENCES t_users(f_id) ON DELETE CASCADE,
    f_channel_id TEXT NOT NULL,
    f_subscribed_at TIMESTAMP DEFAULT NOW(),
    f_last_rank INT,  -- 마지막으로 기록된 등수
    f_last_rank_checked_at TIMESTAMP,  -- 마지막 등수 확인 시간
    f_last_reliability_grade VARCHAR(10),  -- 마지막 신뢰도 그레이드 (Red/Yellow/Blue)
    f_last_reliability_score INT,  -- 마지막 신뢰도 점수
    f_last_top10_percent_status BOOLEAN DEFAULT FALSE,  -- 마지막 상위 10% 진입 여부
    f_notification_enabled BOOLEAN DEFAULT TRUE,  -- 알림 활성화 여부
    UNIQUE(f_user_id, f_channel_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_user_id ON t_channel_subscriptions(f_user_id);
CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_channel_id ON t_channel_subscriptions(f_channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_subscriptions_notification ON t_channel_subscriptions(f_notification_enabled) WHERE f_notification_enabled = TRUE;

-- 코멘트 추가
COMMENT ON TABLE t_channel_subscriptions IS '사용자가 분석한 채널을 자동 구독하고 랭킹 변동 알림을 관리하는 테이블';
COMMENT ON COLUMN t_channel_subscriptions.f_last_rank IS '마지막으로 기록된 채널의 신뢰도 등수 (카테고리별)';
COMMENT ON COLUMN t_channel_subscriptions.f_last_rank_checked_at IS '마지막으로 등수를 확인한 시간';
COMMENT ON COLUMN t_channel_subscriptions.f_notification_enabled IS '해당 채널의 랭킹 변동 알림 수신 여부';
