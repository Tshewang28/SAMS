-- ============================================================
-- SAMS CENTRAL STORAGE + XI/XII STREAM SUPPORT
-- Run this ONCE in the Supabase SQL Editor.
--
-- Purpose:
--   1. One shared SAMS data store for phone + laptop + other devices.
--   2. Supabase Realtime support for shared application data.
--   3. Grade IV-X uses Section; Grade XI-XII uses Stream.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CENTRAL APPLICATION STORE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sams_store (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sams_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SAMS authenticated users can read central store"
ON public.sams_store;

CREATE POLICY "SAMS authenticated users can read central store"
ON public.sams_store
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "SAMS authenticated users can write central store"
ON public.sams_store;

CREATE POLICY "SAMS authenticated users can write central store"
ON public.sams_store
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "SAMS authenticated users can update central store"
ON public.sams_store;

CREATE POLICY "SAMS authenticated users can update central store"
ON public.sams_store
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "SAMS authenticated users can delete central store"
ON public.sams_store;

CREATE POLICY "SAMS authenticated users can delete central store"
ON public.sams_store
FOR DELETE
TO authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.sams_store
TO authenticated;

-- ------------------------------------------------------------
-- 2. STAFF CLASS ASSIGNMENT FIELDS
-- ------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS assigned_class TEXT,
    ADD COLUMN IF NOT EXISTS assigned_section TEXT,
    ADD COLUMN IF NOT EXISTS assigned_stream TEXT;

-- ------------------------------------------------------------
-- 3. REALTIME
--
-- Add sams_store to the Supabase Realtime publication if it is
-- not already there.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'sams_store'
    ) THEN
        ALTER PUBLICATION supabase_realtime
        ADD TABLE public.sams_store;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4. VERIFY
-- ------------------------------------------------------------
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sams_store'
ORDER BY ordinal_position;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
      'assigned_class',
      'assigned_section',
      'assigned_stream'
  )
ORDER BY column_name;
