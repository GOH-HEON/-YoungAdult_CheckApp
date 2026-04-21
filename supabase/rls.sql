-- Standalone RLS policy examples (same baseline as schema.sql)

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.is_active = true
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

alter table public.members enable row level security;
alter table public.newcomer_profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance_records enable row level security;
alter table public.departments enable row level security;
alter table public.meeting_types enable row level security;
alter table public.users enable row level security;

create policy members_admin_all
on public.members
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy newcomer_profiles_admin_all
on public.newcomer_profiles
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy meetings_admin_all
on public.meetings
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy attendance_records_admin_all
on public.attendance_records
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy departments_admin_all
on public.departments
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy meeting_types_admin_all
on public.meeting_types
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy users_admin_all
on public.users
for all
using (public.is_admin_user())
with check (public.is_admin_user());
