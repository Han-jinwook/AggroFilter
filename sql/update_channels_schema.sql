-- Add language and country columns to t_channels for global ranking
ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_language VARCHAR(10) DEFAULT 'ko';
ALTER TABLE t_channels ADD COLUMN IF NOT EXISTS f_country VARCHAR(10) DEFAULT 'KR';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_lang_country_cat ON t_channels (f_language, f_country, f_official_category_id);
