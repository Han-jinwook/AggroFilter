-- Migration: Add language column to t_channels for global ranking v3.1
-- Date: 2026-02-20
-- Purpose: Support language-only ranking system (country removed)

-- Step 1: Add f_language column as nullable first (fast)
ALTER TABLE t_channels 
  ADD COLUMN IF NOT EXISTS f_language VARCHAR(10);

-- Step 2: Set default for new rows
ALTER TABLE t_channels 
  ALTER COLUMN f_language SET DEFAULT 'ko';

-- Step 3: Update existing NULL values (will be done in batches if needed)
-- For now, leave as NULL and update via application logic

-- Note: Index creation moved to separate script to avoid timeout
-- Run manually: CREATE INDEX IF NOT EXISTS idx_channels_language_category ON t_channels(f_language, f_official_category_id);

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 't_channels' AND column_name = 'f_language'
  ) THEN
    RAISE NOTICE 't_channels.f_language column added successfully';
  ELSE
    RAISE EXCEPTION 't_channels.f_language column not found after migration';
  END IF;
END $$;
