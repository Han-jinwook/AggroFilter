-- =========================================================
-- DROP OBSOLETE COLUMNS - GENERATED ON 2026-05-30
-- Run this script in your Supabase SQL Editor to delete
-- the 10 obsolete columns across remaining tables.
-- =========================================================

-- [BACKUP SELECT QUERIES (Optional: Run these first to export legacy data if needed)]
-- SELECT f_channel_id, f_last_analyzed_at FROM public.t_channels WHERE f_last_analyzed_at IS NOT NULL;
-- SELECT f_id, f_email_sent, f_email_data FROM public.t_notifications WHERE f_email_sent IS NOT NULL OR f_email_data IS NOT NULL;
-- SELECT f_id, f_ad_free_until, f_credits FROM public.t_users WHERE f_ad_free_until IS NOT NULL OR f_credits != 0;
-- SELECT f_video_id, f_like_count, f_language_source FROM public.t_videos WHERE f_like_count IS NOT NULL OR f_language_source IS NOT NULL;

-- 1. t_channel_subscriptions
ALTER TABLE public.t_channel_subscriptions DROP COLUMN IF EXISTS f_top10_notified_at;

-- 2. t_channels
ALTER TABLE public.t_channels DROP COLUMN IF EXISTS f_last_analyzed_at;

-- 3. t_notifications
ALTER TABLE public.t_notifications DROP COLUMN IF EXISTS f_email_sent;
ALTER TABLE public.t_notifications DROP COLUMN IF EXISTS f_email_data;

-- 4. t_payment_logs
ALTER TABLE public.t_payment_logs DROP COLUMN IF EXISTS f_payment_data;

-- 5. t_unclaimed_payments
ALTER TABLE public.t_unclaimed_payments DROP COLUMN IF EXISTS f_payment_data;

-- 6. t_users
ALTER TABLE public.t_users DROP COLUMN IF EXISTS f_ad_free_until;
ALTER TABLE public.t_users DROP COLUMN IF EXISTS f_credits;

-- 7. t_videos
ALTER TABLE public.t_videos DROP COLUMN IF EXISTS f_like_count;
ALTER TABLE public.t_videos DROP COLUMN IF EXISTS f_language_source;
