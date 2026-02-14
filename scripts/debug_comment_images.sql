-- 댓글 프로필 이미지 문제 디버깅
-- 댓글과 사용자 정보의 연결 상태 확인

-- 1. 최근 댓글과 사용자 정보 확인
SELECT 
  c.f_id as comment_id,
  c.f_text,
  c.f_user_id as comment_user_id,
  u.f_id as user_table_id,
  u.f_email,
  u.f_nickname,
  u.f_image,
  c.f_created_at
FROM t_comments c
LEFT JOIN t_users u ON c.f_user_id = u.f_id
WHERE c.f_created_at > NOW() - INTERVAL '1 day'
ORDER BY c.f_created_at DESC
LIMIT 10;

-- 2. chiu3@naver.com 사용자의 f_id 확인
SELECT f_id, f_email, f_nickname, f_image
FROM t_users
WHERE f_email = 'chiu3@naver.com';

-- 3. JOIN이 실패하는 댓글 찾기 (f_user_id가 t_users.f_id와 매칭 안 됨)
SELECT 
  c.f_id,
  c.f_text,
  c.f_user_id,
  c.f_created_at
FROM t_comments c
LEFT JOIN t_users u ON c.f_user_id = u.f_id
WHERE u.f_id IS NULL
ORDER BY c.f_created_at DESC
LIMIT 10;

-- 4. 특정 댓글의 상세 정보
SELECT 
  c.*,
  u.f_email,
  u.f_nickname,
  u.f_image
FROM t_comments c
LEFT JOIN t_users u ON c.f_user_id = u.f_id
WHERE c.f_text LIKE '%이제 되니%'
   OR c.f_text LIKE '%이배부터%'
   OR c.f_text LIKE '%재속%'
ORDER BY c.f_created_at DESC;
