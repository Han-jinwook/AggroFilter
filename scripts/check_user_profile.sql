-- 사용자 프로필 정보 확인
-- chiu3@naver.com 계정의 프로필 이미지 상태 확인

-- 1. 사용자 정보 확인
SELECT 
  f_id,
  f_email,
  f_nickname,
  f_image,
  f_created_at,
  f_updated_at
FROM t_users 
WHERE f_email = 'chiu3@naver.com';

-- 2. 최근 댓글 작성자 정보 확인
SELECT 
  c.f_id as comment_id,
  c.f_text,
  c.f_created_at,
  u.f_email,
  u.f_nickname,
  u.f_image
FROM t_comments c
JOIN t_users u ON c.f_user_id = u.f_id
WHERE u.f_email = 'chiu3@naver.com'
ORDER BY c.f_created_at DESC
LIMIT 5;

-- 3. f_image가 NULL인 사용자 수 확인
SELECT COUNT(*) as users_without_image
FROM t_users
WHERE f_image IS NULL;
