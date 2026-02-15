CREATE TABLE IF NOT EXISTS t_notifications (
  f_id BIGSERIAL PRIMARY KEY,
  f_user_id TEXT NOT NULL,
  f_type TEXT NOT NULL,
  f_message TEXT NOT NULL,
  f_link TEXT,
  f_is_read BOOLEAN DEFAULT FALSE,
  f_email_sent BOOLEAN DEFAULT FALSE,
  f_email_data JSONB,
  f_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON t_notifications (f_user_id, f_is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON t_notifications (f_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON t_notifications (f_email_sent) WHERE f_email_sent = FALSE;

-- Migration for existing tables:
-- ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS f_email_sent BOOLEAN DEFAULT FALSE;
-- ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS f_email_data JSONB;
