-- SAMS Staff Management - Supabase permissions
-- Run this once in Supabase SQL Editor.

-- 1. Add Vice Principal to the existing user_role enum if it is missing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role'
          AND n.nspname = 'public'
          AND e.enumlabel = 'vice_principal'
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'vice_principal';
    END IF;
END $$;

-- 2. Use a SECURITY DEFINER helper so RLS does not recursively query profiles.
CREATE OR REPLACE FUNCTION public.sams_is_staff_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role::text IN ('admin', 'principal', 'vice_principal')
          AND COALESCE(active, true) = true
    );
$$;

REVOKE ALL ON FUNCTION public.sams_is_staff_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sams_is_staff_manager() TO authenticated;

-- 3. Allow Administrator, Principal and Vice Principal to edit profiles.
DROP POLICY IF EXISTS "Staff managers can update SAMS profiles" ON public.profiles;
CREATE POLICY "Staff managers can update SAMS profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.sams_is_staff_manager())
WITH CHECK (public.sams_is_staff_manager());

-- 4. Allow the same management roles to delete staff profiles.
DROP POLICY IF EXISTS "Staff managers can delete SAMS profiles" ON public.profiles;
CREATE POLICY "Staff managers can delete SAMS profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.sams_is_staff_manager());

-- 5. Keep all authenticated users able to view registered profiles.
DROP POLICY IF EXISTS "profiles_view_authenticated" ON public.profiles;
CREATE POLICY "profiles_view_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
