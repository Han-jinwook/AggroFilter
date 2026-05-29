-- =========================================================
-- DROP SOCIAL & COMMENT & PREDICTION ELEMENTS - 2026-05-30
-- =========================================================

-- 1. DROP OBSOLETE TABLES
DROP TABLE IF EXISTS public.t_comment_interactions CASCADE;
DROP TABLE IF EXISTS public.t_comments CASCADE;
DROP TABLE IF EXISTS public.t_interactions CASCADE;
DROP TABLE IF EXISTS public.t_prediction_quiz CASCADE;

-- 2. DROP PREDICTION COLUMNS FROM t_users
ALTER TABLE public.t_users DROP COLUMN IF EXISTS total_predictions CASCADE;
ALTER TABLE public.t_users DROP COLUMN IF EXISTS avg_gap CASCADE;
ALTER TABLE public.t_users DROP COLUMN IF EXISTS current_tier CASCADE;
ALTER TABLE public.t_users DROP COLUMN IF EXISTS current_tier_label CASCADE;
ALTER TABLE public.t_users DROP COLUMN IF EXISTS tier_emoji CASCADE;
