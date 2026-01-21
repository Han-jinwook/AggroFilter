-- Add f_user_id column to t_analyses table for user-specific analysis tracking

ALTER TABLE t_analyses 
ADD COLUMN IF NOT EXISTS f_user_id UUID REFERENCES t_users(f_id);

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON t_analyses(f_user_id);

-- Add comment
COMMENT ON COLUMN t_analyses.f_user_id IS 'User who requested this analysis (nullable for anonymous analyses)';
