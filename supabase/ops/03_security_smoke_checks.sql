-- Phase 2: Security smoke checks
-- Use Supabase SQL Editor and App QA together.

-- 1) Role distribution check
select role, is_active, count(*) as cnt
from public.users
group by role, is_active
order by role, is_active desc;

-- 2) Quick data presence checks
select count(*) as members_count from public.members;
select count(*) as meetings_count from public.meetings;
select count(*) as attendance_count from public.attendance_records;

-- 3) Manual app QA (must be done with real login)
-- viewer account:
-- - /dashboard, /members, /attendance/view, /reports, /leaders should load
-- - /attendance/check, /members/new, /settings should block/redirect
-- - POST /api/attendance/save should return 403
-- - GET /api/attendance/template should return 403
--
-- admin account:
-- - all write features should work normally
