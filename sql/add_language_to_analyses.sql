-- t_analyses에 f_language 컬럼 추가
-- 영상 분석 시 감지된 언어를 저장하기 위함
ALTER TABLE t_analyses ADD COLUMN IF NOT EXISTS f_language VARCHAR;

-- 기존 데이터: t_channels의 f_language로 채워넣기
UPDATE t_analyses a
SET f_language = COALESCE(c.f_language, 'korean')
FROM t_channels c
WHERE a.f_channel_id = c.f_channel_id
  AND a.f_language IS NULL;
