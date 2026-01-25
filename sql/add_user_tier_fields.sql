-- t_users 테이블에 등급 관련 필드 추가
ALTER TABLE t_users 
ADD COLUMN IF NOT EXISTS current_tier VARCHAR(10) DEFAULT 'B',
ADD COLUMN IF NOT EXISTS current_tier_label VARCHAR(50) DEFAULT '일반인',
ADD COLUMN IF NOT EXISTS tier_emoji VARCHAR(10) DEFAULT '👤',
ADD COLUMN IF NOT EXISTS total_predictions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_gap DECIMAL(5,2) DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_tier ON t_users(current_tier);

-- 롤백용 SQL (필요시 사용)
-- ALTER TABLE t_users 
-- DROP COLUMN IF EXISTS current_tier,
-- DROP COLUMN IF EXISTS current_tier_label,
-- DROP COLUMN IF EXISTS tier_emoji,
-- DROP COLUMN IF EXISTS total_predictions,
-- DROP COLUMN IF EXISTS avg_gap;
