-- 프로필 이미지가 NULL인 사용자에게 기본 이미지 설정
-- 
-- 옵션 1: 기본 아바타 URL 설정 (Gravatar 또는 UI Avatars 사용)
-- 옵션 2: 특정 사용자에게만 이미지 설정

-- 1. 현재 프로필 이미지 상태 확인
SELECT f_email, f_nickname, f_image
FROM t_users
WHERE f_email = 'chiu3@naver.com';

-- 2. 옵션 A: UI Avatars 서비스 사용 (이니셜 기반 자동 생성)
-- 닉네임 '멀린'의 첫 글자를 사용한 아바타 URL
UPDATE t_users
SET f_image = 'https://ui-avatars.com/api/?name=멀린&size=128&background=3B82F6&color=fff&bold=true'
WHERE f_email = 'chiu3@naver.com';

-- 3. 옵션 B: 실제 프로필 이미지 URL이 있다면 (예시)
-- UPDATE t_users
-- SET f_image = 'https://your-image-url.com/profile.jpg'
-- WHERE f_email = 'chiu3@naver.com';

-- 4. 결과 확인
SELECT f_email, f_nickname, f_image
FROM t_users
WHERE f_email = 'chiu3@naver.com';
