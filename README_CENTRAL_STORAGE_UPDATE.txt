SAMS CENTRAL STORAGE UPDATE
============================

This update is based on the existing SAMS 1 project. No new students.js,
realtime-sync.js, cloud-store.js or other invented files are required.

CENTRAL STORAGE
---------------
The existing js/sams-cloud.js now mirrors the existing SAMS localStorage
data keys into one Supabase table named public.sams_store.

The shared data keys include:
- sams_accounts
- sams_students
- sams_classes
- sams_assessment_criteria
- sams_assessment_records
- sams_assessment_cache
- sams_games_sports_records
- sams_discipline_records
- sams_volunteer_programs
- sams_volunteer_records
- sams_reports
- sams_hall_of_fame
- sams_hall_of_fame_records
- sams_class_ranking
- sams_ranking
- sams_recent_activities
- sams_school_settings
- sams_system_settings

Login/session keys are NOT cloud-shared because they are device/session specific.

PHONE + LAPTOP
--------------
Both devices read and write the same public.sams_store rows after signing in
to the same Supabase project.

Existing local-only records are merged into cloud array data when a matching
cloud key already exists. Cloud data remains authoritative for duplicate
records and scalar settings.

SUPABASE REALTIME
-----------------
The central store subscribes to Supabase Realtime. Remote changes are written
into the local cache and a "sams-cloud-updated" browser event is dispatched.

STAFF MANAGEMENT
----------------
Grade IV-X  -> Section A, B, C, D
Grade XI-XII -> Stream Arts, Science, Commerce

The staff page now uses the existing js/staff-management.js file and reads
staff profiles directly from Supabase.

IMPORTANT
---------
Run SAMS_CENTRAL_STORAGE.sql once in the Supabase SQL Editor.

Also make sure the profiles table has:
- assigned_class
- assigned_section
- assigned_stream

The supplied SAMS_staff_management_profiles_policy.sql has been updated for
assigned_stream.

FILES EDITED
------------
1. js/sams-cloud.js
   Central shared storage, migration/merge, realtime subscription.

2. js/login.js
   Prevents a device login from replacing sams_accounts with only the
   currently logged-in user; cloud data is pulled first and the current
   account is merged.

3. js/staff-management.js
   Clean central Supabase staff management with Section/Stream handling.

4. staff-management.html
   Uses external staff-management.js, fixes CSS placement, adds Stream
   field and changes the table heading to CLASS / SECTION / STREAM.

5. SAMS_staff_management_profiles_policy.sql
   Adds assigned_stream to profiles.

6. SAMS_CENTRAL_STORAGE.sql
   Creates/permits the central sams_store table and enables Supabase Realtime.
