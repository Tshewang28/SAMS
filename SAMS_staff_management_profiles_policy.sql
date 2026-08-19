-- =============================================================
-- SAMS STAFF MANAGEMENT - FINAL CENTRAL PERMISSIONS
--
-- VISIBILITY
-- -------------------------------------------------------------
-- Every authenticated SAMS user can VIEW the complete registered
-- STAFF list. Student profiles are not exposed through this policy
-- (except a user can always see their own profile).
--
-- MANAGEMENT
-- -------------------------------------------------------------
-- Only Administrator, Principal and Vice Principal can:
--   * Edit staff
--   * Delete staff
--   * Approve / reject staff
--   * Change staff roles
--   * Assign / remove assessor
--
-- Run this ONCE in Supabase SQL Editor.
-- =============================================================

-- Class Teacher assignment fields. Safe to run repeatedly.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS assigned_class TEXT,
    ADD COLUMN IF NOT EXISTS assigned_section TEXT,
    ADD COLUMN IF NOT EXISTS assigned_stream TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- Manager helper
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(replace(coalesce(p.role, ''), '_', ' ')) IN (
              'admin',
              'administrator',
              'principal',
              'vice principal'
          )
          AND coalesce(p.active, false) = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_staff_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_manager() TO authenticated;

-- -------------------------------------------------------------
-- SELECT: ALL AUTHENTICATED USERS CAN SEE STAFF
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_view_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own SAMS profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own SAMS profile" ON public.profiles;
DROP POLICY IF EXISTS "SAMS staff managers can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "SAMS authenticated users can view staff profiles" ON public.profiles;

CREATE POLICY "SAMS authenticated users can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR lower(replace(coalesce(role, ''), '_', ' ')) <> 'student'
);

-- -------------------------------------------------------------
-- UPDATE: MANAGERS ONLY
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "SAMS staff managers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "SAMS managers can update staff profiles" ON public.profiles;

CREATE POLICY "SAMS managers can update staff profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.is_staff_manager()
)
WITH CHECK (
    public.is_staff_manager()
);

-- -------------------------------------------------------------
-- DELETE: MANAGERS ONLY
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "SAMS staff managers can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "SAMS managers can delete staff profiles" ON public.profiles;

CREATE POLICY "SAMS managers can delete staff profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    public.is_staff_manager()
);

-- -------------------------------------------------------------
-- Make sure the authenticated browser client can reach the table.
-- RLS still controls which rows may be changed.
-- -------------------------------------------------------------
GRANT SELECT, UPDATE, DELETE ON public.profiles TO authenticated;

-- -------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;
