-- Fix RLS Errors for public.t_analyses table

-- 1. Clean up all previous policies to ensure a clean state.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow read access for anonymous users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow public read access" ON public.t_analyses;

-- 2. Re-enable RLS on the table to fix the 'RLS Disabled' error.
ALTER TABLE public.t_analyses ENABLE ROW LEVEL SECURITY;

-- 3. Re-create a single, simple policy for public read access.
-- This will resolve the errors, though the 'RLS Policy Always True' warning may reappear.
-- It is better to have a warning than a critical error.
CREATE POLICY "Allow public read-only access" ON public.t_analyses
    FOR SELECT
    USING (true);
