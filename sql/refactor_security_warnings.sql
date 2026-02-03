-- Supabase Security Advisor: Address security warnings

-- Warning 1: Extension in Public Schema
-- Move the 'vector' extension to a dedicated 'extensions' schema for better security.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Warning 2: RLS Policy Always True for t_analyses
-- Final approach: For truly public tables, disable RLS and grant SELECT to public roles directly.
-- This is the clearest way to express intent and resolves the linter warning.

-- 1. Remove all RLS policies from the table.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow public read-only access" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow read access for anonymous users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.t_analyses;
DROP POLICY IF EXISTS "Allow public read access" ON public.t_analyses;

-- 2. Disable RLS on the table.
ALTER TABLE public.t_analyses DISABLE ROW LEVEL SECURITY;

-- 3. Grant SELECT permission to anonymous and authenticated users.
GRANT SELECT ON TABLE public.t_analyses TO anon;
GRANT SELECT ON TABLE public.t_analyses TO authenticated;
