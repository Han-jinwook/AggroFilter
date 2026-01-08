CREATE TABLE IF NOT EXISTS t_channel_stats (
  f_channel_id text NOT NULL,
  f_topic text NOT NULL,
  f_video_count integer DEFAULT 0,
  f_avg_accuracy numeric(5,2) DEFAULT 0,
  f_avg_clickbait numeric(5,2) DEFAULT 0,
  f_avg_reliability numeric(5,2) DEFAULT 0,
  f_last_updated timestamp with time zone DEFAULT NOW(),
  PRIMARY KEY (f_channel_id, f_topic),
  FOREIGN KEY (f_channel_id) REFERENCES t_channels(f_id)
);

-- Index for fast ranking queries
CREATE INDEX IF NOT EXISTS idx_channel_stats_topic_reliability 
ON t_channel_stats (f_topic, f_avg_reliability DESC);
