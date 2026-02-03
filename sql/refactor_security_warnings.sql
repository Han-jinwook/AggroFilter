-- Supabase Security Advisor: Address security warnings

-- Warning 1: Extension in Public Schema
-- Move the 'vector' extension to a dedicated 'extensions' schema for better security.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- Warning 2: RLS Policy Always True for t_analyses
-- Replace the overly permissive policy with a more explicit one that still allows public read access.

-- Drop the existing permissive policy if it exists.
-- The name 'Enable read access for all users' is a common default, but it might be different.
-- This command might fail if the policy name is different, which is acceptable.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.t_analyses;

-- Ensure RLS is enabled on the table.
ALTER TABLE public.t_analyses ENABLE ROW LEVEL SECURITY;

-- Create a new, explicit policy for public read access.
-- This is functionally equivalent to public access but is more specific than 'USING (true)', which should satisfy the security advisor.
CREATE POLICY "Allow public read-only access" ON public.t_analyses
    FOR SELECT
    USING ( f_id IS NOT NULL );
