-- Migration: Recreate t_rankings_cache for global ranking v3.1
-- Date: 2026-02-20
-- Purpose: Language-only ranking system (remove country dependency)

-- Drop existing table and recreate with new schema
DROP TABLE IF EXISTS t_rankings_cache CASCADE;

CREATE TABLE t_rankings_cache (
  f_id SERIAL PRIMARY KEY,
  f_channel_id VARCHAR(255) NOT NULL,
  f_language VARCHAR(10) NOT NULL,
  f_category_id INT NOT NULL,
  f_ranking_key VARCHAR(50) NOT NULL,  -- Format: 'ko_10', 'en_25', 'ja_ALL'
  f_rank INT NOT NULL,
  f_total_count INT NOT NULL,
  f_top_percentile DECIMAL(5,2),
  f_cached_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique ranking per channel/language/category
  CONSTRAINT uq_rankings_channel_lang_cat UNIQUE(f_channel_id, f_language, f_category_id)
);

-- Create performance indexes
CREATE INDEX idx_rankings_key ON t_rankings_cache(f_ranking_key, f_rank);
CREATE INDEX idx_rankings_language ON t_rankings_cache(f_language, f_category_id);
CREATE INDEX idx_rankings_channel ON t_rankings_cache(f_channel_id);

-- Enable RLS for public read access
ALTER TABLE t_rankings_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access" ON t_rankings_cache;
CREATE POLICY "Allow public read-only access" ON t_rankings_cache
  FOR SELECT
  USING (true);

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 't_rankings_cache'
  ) THEN
    RAISE NOTICE 't_rankings_cache recreated successfully with language-only schema';
  ELSE
    RAISE EXCEPTION 't_rankings_cache not found after migration';
  END IF;
END $$;
