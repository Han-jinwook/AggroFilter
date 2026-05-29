-- =========================================================
-- DROP OBSOLETE TABLES - GENERATED ON 2026-05-30
-- Run this script in your Supabase SQL Editor to delete
-- the 7 defunct tables.
-- BACKUP IS SAVED IN: sql/backup_obsolete_tables_20260530.sql
-- =========================================================

DROP TABLE IF EXISTS public.t_verification_codes CASCADE;
DROP TABLE IF EXISTS public.t_magic_links CASCADE;
DROP TABLE IF EXISTS public.family_model_rates CASCADE;
DROP TABLE IF EXISTS public.t_categories CASCADE;
DROP TABLE IF EXISTS public.t_topics_master CASCADE;
DROP TABLE IF EXISTS public.t_cafe24_tokens CASCADE;
DROP TABLE IF EXISTS public.t_cafe24_webhook_events CASCADE;
