INSERT INTO t_channel_stats (
  f_channel_id, f_topic, f_video_count, 
  f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
  f_last_updated
)
SELECT 
  f_channel_id, 
  f_topic, 
  COUNT(*)::integer, 
  ROUND(AVG(f_accuracy_score), 2), 
  ROUND(AVG(f_clickbait_score), 2), 
  ROUND(AVG(f_reliability_score), 2),
  NOW()
FROM t_analyses a
JOIN t_channels c ON a.f_channel_id = c.f_id
WHERE a.f_channel_id IS NOT NULL AND a.f_topic IS NOT NULL AND a.f_reliability_score IS NOT NULL
GROUP BY a.f_channel_id, a.f_topic
ON CONFLICT (f_channel_id, f_topic) 
DO UPDATE SET 
  f_video_count = EXCLUDED.f_video_count,
  f_avg_accuracy = EXCLUDED.f_avg_accuracy,
  f_avg_clickbait = EXCLUDED.f_avg_clickbait,
  f_avg_reliability = EXCLUDED.f_avg_reliability,
  f_last_updated = NOW();
