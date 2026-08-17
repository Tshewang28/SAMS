SAMS STAFF MANAGEMENT - FINAL FIX
=================================

This version fixes:
1. Staff Edit/Save flow.
2. Vice Principal role persistence.
3. Non-Class Teacher assessor persistence.
4. Assessor removal persistence.
5. Class Teachers cannot be appointed as assessors.
6. Administrator, Principal and Vice Principal can manage staff/assessor appointments.
7. Staff -> Role column spacing.
8. Actions column wrapping/spacing.
9. Class/Section fields are disabled for non-Class-Teacher roles.
10. Table loading colspan corrected to 7 columns.

IMPORTANT SUPABASE STEP
-----------------------
Before testing Edit Staff, open Supabase SQL Editor and run:

SUPABASE_STAFF_PERMISSIONS.sql

This adds the missing Vice Principal enum value and the RLS UPDATE/DELETE permissions.

After running SQL:
1. Restart the local server with: npm start
2. Open http://localhost:3000/staff-management.html
3. Press Ctrl+F5.
4. Edit a staff member.
5. Change role/status and click Save Staff.
6. Refresh the page to confirm the change persists.

Assessor rules in this build:
- Administrator: can manage assessor appointments, cannot be appointed by the assessor button.
- Principal: can manage assessor appointments, cannot be appointed by the assessor button.
- Vice Principal: can manage assessor appointments and may be appointed as assessor.
- Non-Class Teacher: may be appointed as assessor.
- Class Teacher: must never be an assessor.
