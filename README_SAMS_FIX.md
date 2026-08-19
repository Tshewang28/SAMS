# SAMS Fixed Version

This package contains the corrected SAMS frontend and the Supabase SQL fix required for registration.

## IMPORTANT: one Supabase step is still required

After uploading the files to GitHub and deploying with Vercel, open the Supabase SQL Editor and run:

`SAMS_REGISTRATION_FIX.sql`

Run it once. It replaces the `handle_new_sams_user` trigger with the corrected version and applies the final staff-management policies.

## Main fixes

### 1. Registration
`js/register.js`
- Removed all browser-side INSERTs into `public.profiles`.
- Supabase Auth `signUp()` is now the only browser-side account creation step.
- The database trigger creates the profile.
- Staff registration sends `account_type = Staff`.
- Staff success message is:
  `Registration successful. Your account is waiting for Administrator approval.`
- Student registration sends `account_type = Student`.
- Administrator registration sends `account_type = Administrator`.
- Added clearer handling for duplicate email, database role configuration errors and email rate limits.
- Added detection for Supabase's empty-identities duplicate-email response.
- `register.html` now loads `register.js?v=5`.

### 2. Supabase registration trigger
`SAMS_REGISTRATION_FIX.sql`
- Administrator -> `admin`, active = true.
- Student -> `student`, active = true.
- Staff -> `non_class_teacher`, active = false.
- `is_assessor` starts false.
- Never writes the invalid `pending` value to the `user_role` enum.
- Uses `ON CONFLICT (id)` so the profile is not inserted twice.
- Re-creates/enables `on_auth_user_created`.
- Rejects a second active Administrator.
- No `teacher` role is created.

### 3. Staff Management
`staff-management.html`
- Removed the unwanted `Teacher` option from the Administrator role dropdown.
- Removed `Assessor` as a selectable staff role; assessor status is managed separately.
- Valid role choices are:
  - Class Teacher
  - Non-Class Teacher
  - Vice Principal
  - Principal
  - Administrator
- Removed writes to profile columns that are not in the current `profiles` schema (`status`, `assigned_class`, `assigned_section`).
- Staff list now reads only the current core `profiles` columns.
- Staff approval uses `active` as the approval state.
- Class Teachers cannot be appointed as assessors.
- Only Administrator, Principal and Vice Principal receive management controls.

### 4. Administrator approval page
`js/admin-approval.js`
- Removed `Teacher` from the role dropdown.
- Added all valid staff-management roles.
- Removed invalid `Pending` database-role writes.
- Uses valid `non_class_teacher` as the temporary database role until a permanent role is assigned.
- Syncs only columns that exist in the current `profiles` schema.
- `admin-approval.html` now loads `admin-approval.js?v=2`.

### 5. Login
`js/login.js`
- Removed `Teacher` as an allowed SAMS role.
- Legacy `assessor` role is normalized to Non-Class Teacher; assessor appointment remains controlled by `is_assessor`.

### 6. Compatibility
`js/staff-management.js`
- Removed the visible/assignable `Teacher` role while preserving the rest of the staff-management functionality.

## After deployment: recommended test

Use ONE fresh staff email.

Expected registration result:
`Registration successful. Your account is waiting for Administrator approval.`

Then verify in Supabase `public.profiles`:

- `full_name` = registered name
- `email` = registered email
- `employee_code` = Employee ID
- `role` = `non_class_teacher`
- `active` = `false`
- `is_assessor` = `false`

Then, as Administrator, approve the account and assign one of the five valid staff roles.

Do not create a database role named `Teacher`.
