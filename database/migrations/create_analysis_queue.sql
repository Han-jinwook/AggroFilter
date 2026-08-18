-- t_analysis_queue 테이블 생성
CREATE TABLE IF NOT EXISTS t_analysis_queue (
  f_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  f_user_id TEXT, -- 로그인된 유저 ID (허브 UUID)
  f_video_url TEXT NOT NULL,
  f_video_id VARCHAR(11) NOT NULL,
  f_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  f_created_at TIMESTAMPTZ DEFAULT NOW(),
  f_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (조회 최적화)
CREATE INDEX IF NOT EXISTS idx_t_analysis_queue_user_status ON t_analysis_queue(f_user_id, f_status);

-- RLS 활성화 (외부 접근 차단 및 보안 수칙 준수)
ALTER TABLE t_analysis_queue ENABLE ROW LEVEL SECURITY;
