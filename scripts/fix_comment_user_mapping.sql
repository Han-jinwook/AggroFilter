-- 댓글의 f_user_id를 올바른 사용자 UUID로 업데이트
-- 
-- 문제: 댓글 작성 시 f_user_id가 잘못된 값으로 저장되었을 수 있음
-- 해결: 사용자 이메일을 기반으로 올바른 f_id로 업데이트

-- 1. 현재 상태 확인
SELECT 
  c.f_id,
  c.f_text,
  c.f_user_id,
  u.f_id as correct_user_id,
  u.f_email,
  u.f_image
FROM t_comments c
LEFT JOIN t_users u ON c.f_user_id = u.f_id
WHERE c.f_created_at > NOW() - INTERVAL '1 day'
ORDER BY c.f_created_at DESC
LIMIT 5;

-- 2. chiu3@naver.com 사용자의 올바른 f_id 찾기
SELECT f_id, f_email, f_nickname, f_image
FROM t_users
WHERE f_email = 'chiu3@naver.com';

-- 3. 옵션 A: 최근 댓글의 f_user_id를 올바른 UUID로 업데이트
-- (먼저 위 쿼리로 올바른 f_id를 확인한 후 실행)
-- 
-- UPDATE t_comments
-- SET f_user_id = (SELECT f_id FROM t_users WHERE f_email = 'chiu3@naver.com')
-- WHERE f_user_id NOT IN (SELECT f_id FROM t_users)
--   AND f_created_at > NOW() - INTERVAL '7 days';

-- 4. 옵션 B: 특정 댓글만 수정 (더 안전)
-- 먼저 수정할 댓글 ID를 확인
SELECT f_id, f_text, f_user_id
FROM t_comments
WHERE f_user_id NOT IN (SELECT f_id FROM t_users)
ORDER BY f_created_at DESC;

-- 그 다음 개별 업데이트
-- UPDATE t_comments
-- SET f_user_id = (SELECT f_id FROM t_users WHERE f_email = 'chiu3@naver.com')
-- WHERE f_id = 'YOUR_COMMENT_ID_HERE';

-- 5. 결과 확인
SELECT 
  c.f_id,
  c.f_text,
  c.f_user_id,
  u.f_email,
  u.f_nickname,
  u.f_image
FROM t_comments c
JOIN t_users u ON c.f_user_id = u.f_id
WHERE c.f_created_at > NOW() - INTERVAL '1 day'
ORDER BY c.f_created_at DESC;
