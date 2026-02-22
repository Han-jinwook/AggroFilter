-- f_user_id 일관성 확보를 위한 마이그레이션 (Email -> UUID)
-- 작성일: 2026-02-22 22:00

DO $$ 
DECLARE 
    r record;
BEGIN
    -- 1. t_analyses: f_user_id (Email -> UUID)
    -- 먼저 t_users에 없는 이메일들을 위해 유저를 생성하는 것은 이미 API에서 하고 있다고 가정함.
    -- 만약 매칭되지 않는 데이터가 있다면 NULL로 남거나 수동 처리가 필요함.
    UPDATE t_analyses a
    SET f_user_id = u.f_id
    FROM t_users u
    WHERE a.f_user_id = u.f_email;

    -- 2. t_channel_subscriptions: f_user_id (Email -> UUID)
    -- UNIQUE(f_user_id, f_channel_id) 제약조건이 있으므로 주의 필요
    -- (현재 DB_SCHEMA에는 UNIQUE 제약조건이 명시되어 있지 않으나 route.ts에서 처리 중)
    UPDATE t_channel_subscriptions s
    SET f_user_id = u.f_id
    FROM t_users u
    WHERE s.f_user_id = u.f_email;

    -- 3. t_notifications: f_user_id (Email -> UUID)
    UPDATE t_notifications n
    SET f_user_id = u.f_id
    FROM t_users u
    WHERE n.f_user_id = u.f_email;

    -- 4. t_prediction_quiz: user_email -> f_user_id (UUID)
    -- 먼저 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='t_prediction_quiz' AND column_name='f_user_id') THEN
        ALTER TABLE t_prediction_quiz ADD COLUMN f_user_id TEXT;
    END IF;

    UPDATE t_prediction_quiz q
    SET f_user_id = u.f_id
    FROM t_users u
    WHERE q.user_email = u.f_email;

    -- user_email이 'anonymous'인 경우 등 예외 처리 (필요시)
    -- UPDATE t_prediction_quiz SET f_user_id = 'anonymous' WHERE user_email = 'anonymous' AND f_user_id IS NULL;

END $$;
