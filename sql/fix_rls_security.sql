-- AggroFilter Comprehensive RLS Security Fix
-- 작성일: 2026-02-22 21:44

-- [1] 모든 테이블에 기본적으로 RLS 활성화
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- [2] 공개 조회 가능 테이블 (Read-only for Public)
-- 비로그인 사용자도 서비스 이용을 위해 조회는 가능해야 함.
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['t_channel_stats', 't_channels', 't_rankings_cache', 't_categories', 't_videos', 't_analyses', 't_topics_master', 't_comments', 't_interactions'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow public read" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Allow public read" ON public.%I FOR SELECT USING (true);', t);
    END LOOP;
END $$;

-- [3] 사용자 본인 데이터 전용 테이블 (Owner Access Only)
-- t_channel_subscriptions (구독)
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.t_channel_subscriptions;
CREATE POLICY "Users can manage own subscriptions" 
ON public.t_channel_subscriptions FOR ALL 
USING (f_user_id = auth.jwt() ->> 'email' OR f_user_id = auth.uid()::text);

-- t_notifications (알림)
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.t_notifications;
CREATE POLICY "Users can manage own notifications" 
ON public.t_notifications FOR ALL 
USING (f_user_id = auth.jwt() ->> 'email' OR f_user_id = auth.uid()::text);

-- t_prediction_quiz (퀴즈 내역)
DROP POLICY IF EXISTS "Users can view own quiz results" ON public.t_prediction_quiz;
CREATE POLICY "Users can view own quiz results" 
ON public.t_prediction_quiz FOR SELECT 
USING (user_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Users can insert own quiz results" ON public.t_prediction_quiz;
CREATE POLICY "Users can insert own quiz results" 
ON public.t_prediction_quiz FOR INSERT 
WITH CHECK (user_email = auth.jwt() ->> 'email');

-- t_users (사용자 프로필)
DROP POLICY IF EXISTS "Users can view/update own profile" ON public.t_users;
CREATE POLICY "Users can view/update own profile" 
ON public.t_users FOR ALL 
USING (f_email = auth.jwt() ->> 'email' OR f_id = auth.uid()::text);

-- t_comment_interactions
DROP POLICY IF EXISTS "Users can manage own comment interactions" ON public.t_comment_interactions;
CREATE POLICY "Users can manage own comment interactions" 
ON public.t_comment_interactions FOR ALL 
USING (f_user_id = auth.jwt() ->> 'email' OR f_user_id = auth.uid()::text);

-- [4] 외부 접근 완전 차단 테이블 (Server-side Only)
-- 토큰 및 결제 관련 정보는 외부 API(PostgREST)를 통한 접근을 완전히 차단합니다.
-- 서버 사이드(Node.js)의 pg 라이브러리는 Owner 권한을 가지므로 계속 작동합니다.
-- Policy를 작성하지 않으면 RLS가 활성화된 상태에서 모든 접근이 차단됨.
