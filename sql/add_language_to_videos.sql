-- Migration: Add language columns to t_videos for global ranking v3.1
-- Date: 2026-02-20
-- Purpose: Track language source for data quality monitoring

-- Step 1: Add f_language column as nullable first (fast)
ALTER TABLE t_videos 
  ADD COLUMN IF NOT EXISTS f_language VARCHAR(10);

-- Step 2: Set default for new rows
ALTER TABLE t_videos 
  ALTER COLUMN f_language SET DEFAULT 'ko';

-- Step 3: Add f_language_source column to track detection method
-- Values: 'api', 'transcript', 'user', 'ai'
ALTER TABLE t_videos 
  ADD COLUMN IF NOT EXISTS f_language_source VARCHAR(20) DEFAULT 'user';

-- Note: Index creation moved to separate script to avoid timeout
-- Run manually: CREATE INDEX IF NOT EXISTS idx_videos_language ON t_videos(f_language);

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 't_videos' AND column_name = 'f_language'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 't_videos' AND column_name = 'f_language_source'
  ) THEN
    RAISE NOTICE 't_videos language columns added successfully';
  ELSE
    RAISE EXCEPTION 't_videos language columns not found after migration';
  END IF;
END $$;
