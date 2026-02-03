-- Supabase Security Advisor: Enable RLS and define policies

-- 1. Server-only tables (Deny all public access)
-- The backend uses the service_role key, which bypasses RLS.

-- t_cafe24_tokens
ALTER TABLE public.t_cafe24_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_cafe24_tokens;

-- t_cafe24_webhook_events
ALTER TABLE public.t_cafe24_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_cafe24_webhook_events;

-- t_verification_codes
ALTER TABLE public.t_verification_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_verification_codes;

-- 2. Public read-only tables (Allow public select)

-- t_rankings_cache
ALTER TABLE public.t_rankings_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_rankings_cache;
CREATE POLICY "Allow public read-only access" ON public.t_rankings_cache
    FOR SELECT
    USING (true);

-- t_categories
ALTER TABLE public.t_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_categories;
CREATE POLICY "Allow public read-only access" ON public.t_categories
    FOR SELECT
    USING (true);
