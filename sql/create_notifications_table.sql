CREATE TABLE IF NOT EXISTS t_notifications (
  f_id BIGSERIAL PRIMARY KEY,
  f_user_id TEXT NOT NULL,
  f_type TEXT NOT NULL,
  f_message TEXT NOT NULL,
  f_link TEXT,
  f_is_read BOOLEAN DEFAULT FALSE,
  f_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON t_notifications (f_user_id, f_is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON t_notifications (f_created_at DESC);
