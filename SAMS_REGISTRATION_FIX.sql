-- =============================================================
-- SAMS FINAL REGISTRATION / ROLE FIX
-- Run this ONCE in the Supabase SQL Editor.
--
-- Fixes:
-- 1. Staff registration no longer tries to use the invalid
--    "pending" user_role enum value.
-- 2. The browser does not need INSERT permission on profiles.
-- 3. The auth trigger creates the profile exactly once.
-- 4. Staff starts as non_class_teacher + inactive.
-- 5. Administrator starts as admin + active.
-- 6. Student starts as student + active.
-- 7. is_assessor always starts false.
-- 8. No "Teacher" role is created or assigned.
-- 9. Duplicate profile creation is avoided with ON CONFLICT.
-- 10. A second Administrator registration is rejected by the trigger.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_sams_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    account_type text;
    target_role public.user_role;
    target_active boolean;
BEGIN
    account_type :=
        lower(
            trim(
                coalesce(
                    new.raw_user_meta_data->>'account_type',
                    ''
                )
            )
        );

    -- ---------------------------------------------------------
    -- Determine the ONLY roles used by SAMS registration.
    -- ---------------------------------------------------------

    IF account_type = 'administrator' THEN

        target_role := 'admin'::public.user_role;
        target_active := true;

        -- Only one Administrator is permitted.
        IF EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE role::text = 'admin'
              AND coalesce(active, false) = true
        ) THEN
            RAISE EXCEPTION
                'An Administrator account already exists.';
        END IF;

    ELSIF account_type = 'student' THEN

        target_role := 'student'::public.user_role;
        target_active := true;

    ELSE
        /*
         * Staff registration and any unknown account type are
         * deliberately placed in the valid staff role
         * non_class_teacher until an Administrator assigns the
         * final role.
         */
        target_role := 'non_class_teacher'::public.user_role;
        target_active := false;

    END IF;


    -- ---------------------------------------------------------
    -- Create/update the profile belonging to this Auth user.
    -- The browser must NOT insert this row separately.
    -- ---------------------------------------------------------

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        employee_code,
        role,
        active,
        is_assessor
    )
    VALUES (
        new.id,
        coalesce(
            new.raw_user_meta_data->>'full_name',
            ''
        ),
        new.email,
        nullif(
            new.raw_user_meta_data->>'employee_code',
            ''
        ),
        target_role,
        target_active,
        false
    )
    ON CONFLICT (id)
    DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        employee_code = EXCLUDED.employee_code,
        role = EXCLUDED.role,
        active = EXCLUDED.active;

    RETURN new;
END;
$function$;


-- -------------------------------------------------------------
-- Re-create the Auth trigger so the corrected function is used.
-- -------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_sams_user();


-- -------------------------------------------------------------
-- Secure the trigger function.
-- -------------------------------------------------------------

REVOKE ALL
ON FUNCTION public.handle_new_sams_user()
FROM PUBLIC;


-- =============================================================
-- FINAL STAFF MANAGEMENT PERMISSIONS
-- =============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


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
          AND p.role::text IN (
              'admin',
              'principal',
              'vice_principal'
          )
          AND coalesce(p.active, false) = true
    );
$$;


REVOKE ALL
ON FUNCTION public.is_staff_manager()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.is_staff_manager()
TO authenticated;


-- -------------------------------------------------------------
-- Everyone authenticated can view non-student profiles.
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_view_authenticated"
ON public.profiles;

DROP POLICY IF EXISTS "SAMS authenticated users can view staff profiles"
ON public.profiles;

CREATE POLICY "SAMS authenticated users can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR role::text <> 'student'
);


-- -------------------------------------------------------------
-- Only Administrator / Principal / Vice Principal can update.
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "Staff managers can update SAMS profiles"
ON public.profiles;

DROP POLICY IF EXISTS "SAMS staff managers can update profiles"
ON public.profiles;

DROP POLICY IF EXISTS "SAMS managers can update staff profiles"
ON public.profiles;

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
-- Only Administrator / Principal / Vice Principal can delete.
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "Staff managers can delete SAMS profiles"
ON public.profiles;

DROP POLICY IF EXISTS "SAMS staff managers can delete profiles"
ON public.profiles;

DROP POLICY IF EXISTS "SAMS managers can delete staff profiles"
ON public.profiles;

CREATE POLICY "SAMS managers can delete staff profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    public.is_staff_manager()
);


GRANT SELECT, UPDATE, DELETE
ON public.profiles
TO authenticated;


-- =============================================================
-- VERIFICATION
-- =============================================================

SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_sams_user';


SELECT
    tgname AS trigger_name,
    tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal
ORDER BY tgname;


SELECT
    e.enumlabel AS allowed_role
FROM pg_enum e
JOIN pg_type t
    ON t.oid = e.enumtypid
JOIN pg_namespace n
    ON n.oid = t.typnamespace
WHERE t.typname = 'user_role'
  AND n.nspname = 'public'
ORDER BY e.enumsortorder;
