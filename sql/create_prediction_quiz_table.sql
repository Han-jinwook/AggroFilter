-- 예측 퀴즈 로그 테이블 생성
CREATE TABLE IF NOT EXISTS t_prediction_quiz (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  analysis_id VARCHAR(255) NOT NULL,
  
  -- 사용자 예측값
  predicted_accuracy INTEGER NOT NULL CHECK (predicted_accuracy >= 0 AND predicted_accuracy <= 100),
  predicted_clickbait INTEGER NOT NULL CHECK (predicted_clickbait >= 0 AND predicted_clickbait <= 100),
  predicted_reliability DECIMAL(5,2) NOT NULL,
  
  -- 실제 AI 분석 결과
  actual_reliability DECIMAL(5,2) NOT NULL,
  
  -- 오차 및 등급
  gap DECIMAL(5,2) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  tier_label VARCHAR(50) NOT NULL,
  tier_emoji VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_analysis UNIQUE(user_email, analysis_id),
  CONSTRAINT fk_analysis FOREIGN KEY (analysis_id) REFERENCES t_analyses(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prediction_user ON t_prediction_quiz(user_email);
CREATE INDEX IF NOT EXISTS idx_prediction_tier ON t_prediction_quiz(tier);
CREATE INDEX IF NOT EXISTS idx_prediction_created ON t_prediction_quiz(created_at DESC);

-- 롤백용 SQL (필요시 사용)
-- DROP TABLE IF EXISTS t_prediction_quiz;
