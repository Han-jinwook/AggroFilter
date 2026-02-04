-- 1. Enable RLS for the tables flagged by Security Advisor
ALTER TABLE public.t_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_unclaimed_payments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure a clean state
DROP POLICY IF EXISTS "Public access to t_videos" ON public.t_videos;
DROP POLICY IF EXISTS "Public access to t_channels" ON public.t_channels;
DROP POLICY IF EXISTS "No public access to t_unclaimed_payments" ON public.t_unclaimed_payments;

-- 3. Define policies based on the "Best Practice" for each table type

-- [t_videos & t_channels]: Allow anyone (even unauthenticated) to READ, 
-- but strictly forbid any direct write/update/delete via the client (anon/auth).
-- This handles potential future front-end direct fetches while keeping the data safe.
CREATE POLICY "Public read access to t_videos" ON public.t_videos
FOR SELECT USING (true);

CREATE POLICY "Public read access to t_channels" ON public.t_channels
FOR SELECT USING (true);

-- [t_unclaimed_payments]: Strictly block all direct access from anon/auth roles.
-- Service role (server) and direct DB connections (pg) are exempt from RLS or use higher privileges.
-- We don't create a SELECT policy here, which defaults to denial for anon/auth.
-- But if we want to be explicit:
-- CREATE POLICY "Deny all public access to t_unclaimed_payments" ON public.t_unclaimed_payments 
-- FOR ALL USING (false);

-- 4. Verify RLS status
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('t_videos', 't_channels', 't_unclaimed_payments');
