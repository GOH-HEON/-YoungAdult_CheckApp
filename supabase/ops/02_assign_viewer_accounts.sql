-- Phase 2: Assign executive accounts as read-only viewer
-- Replace emails below and run in Supabase SQL Editor.

begin;

-- Example 1) Promote existing auth users to viewer in public.users
insert into public.users (id, email, name, role, is_active)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'viewer',
  true
from auth.users au
where au.email in (
  'exec1@example.com',
  'exec2@example.com',
  'exec3@example.com'
)
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = 'viewer',
  is_active = true,
  updated_at = now();

-- Example 2) Move a user back to admin (if needed)
-- update public.users
-- set role = 'admin', is_active = true, updated_at = now()
-- where email = 'owner@example.com';

commit;

-- Verification queries
select email, role, is_active, created_at, updated_at
from public.users
order by created_at desc;
