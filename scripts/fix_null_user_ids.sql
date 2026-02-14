-- t_analyses 테이블의 f_user_id가 NULL인 레코드를
-- 사용자 이메일(chiu3@naver.com)로 일괄 업데이트
-- 
-- 실행 방법:
-- 1. Supabase Dashboard > SQL Editor에서 실행
-- 2. 또는 psql 클라이언트에서 실행

-- 1. NULL 레코드 수 확인
SELECT COUNT(*) as null_count 
FROM t_analyses 
WHERE f_user_id IS NULL;

-- 2. 사용자 존재 확인
SELECT f_id, f_email, f_nickname 
FROM t_users 
WHERE f_email = 'chiu3@naver.com';

-- 3. NULL 레코드를 사용자 이메일로 업데이트
UPDATE t_analyses 
SET f_user_id = 'chiu3@naver.com' 
WHERE f_user_id IS NULL;

-- 4. 결과 확인
SELECT COUNT(*) as remaining_null_count 
FROM t_analyses 
WHERE f_user_id IS NULL;

-- 5. 업데이트된 레코드 샘플 확인
SELECT f_id, f_title, f_user_id, f_created_at 
FROM t_analyses 
WHERE f_user_id = 'chiu3@naver.com' 
ORDER BY f_created_at DESC 
LIMIT 10;
