-- Standalone RLS policy examples (same baseline as schema.sql)

create or replace function public.is_read_user()
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
      and u.role in ('admin', 'viewer', 'staff', 'chairboard')
      and u.is_active = true
  );
$$;

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

create or replace function public.is_chairboard_user()
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
      and u.role in ('admin', 'chairboard')
      and u.is_active = true
  );
$$;

create or replace function public.is_personal_notes_user()
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
      and u.is_active = true
      and u.is_personal_notes_owner = true
  );
$$;

revoke all on function public.is_read_user() from public;
grant execute on function public.is_read_user() to authenticated;
revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;
revoke all on function public.is_chairboard_user() from public;
grant execute on function public.is_chairboard_user() to authenticated;
revoke all on function public.is_personal_notes_user() from public;
grant execute on function public.is_personal_notes_user() to authenticated;

alter table public.members enable row level security;
alter table public.newcomer_profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance_records enable row level security;
alter table public.departments enable row level security;
alter table public.meeting_types enable row level security;
alter table public.users enable row level security;
alter table public.leadership_meetings enable row level security;
alter table public.leadership_items enable row level security;
alter table public.chairboard_notes enable row level security;
alter table public.login_history enable row level security;

drop policy if exists users_admin_all on public.users;
drop policy if exists users_read_self_or_admin on public.users;
drop policy if exists users_admin_write on public.users;
create policy users_read_self_or_admin
on public.users
for select
using (public.is_admin_user() or id = auth.uid());

create policy users_admin_write
on public.users
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists members_admin_all on public.members;
drop policy if exists members_read_all on public.members;
drop policy if exists members_admin_write on public.members;
create policy members_read_all
on public.members
for select
using (public.is_read_user());

create policy members_admin_write
on public.members
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists newcomer_profiles_admin_all on public.newcomer_profiles;
drop policy if exists newcomer_profiles_read_all on public.newcomer_profiles;
drop policy if exists newcomer_profiles_admin_write on public.newcomer_profiles;
create policy newcomer_profiles_read_all
on public.newcomer_profiles
for select
using (public.is_read_user());

create policy newcomer_profiles_admin_write
on public.newcomer_profiles
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists meetings_admin_all on public.meetings;
drop policy if exists meetings_read_all on public.meetings;
drop policy if exists meetings_admin_write on public.meetings;
create policy meetings_read_all
on public.meetings
for select
using (public.is_read_user());

create policy meetings_admin_write
on public.meetings
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists attendance_records_admin_all on public.attendance_records;
drop policy if exists attendance_records_read_all on public.attendance_records;
drop policy if exists attendance_records_admin_write on public.attendance_records;
create policy attendance_records_read_all
on public.attendance_records
for select
using (public.is_read_user());

create policy attendance_records_admin_write
on public.attendance_records
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists departments_admin_all on public.departments;
drop policy if exists departments_read_all on public.departments;
drop policy if exists departments_admin_write on public.departments;
create policy departments_read_all
on public.departments
for select
using (public.is_read_user());

create policy departments_admin_write
on public.departments
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists meeting_types_admin_all on public.meeting_types;
drop policy if exists meeting_types_read_all on public.meeting_types;
drop policy if exists meeting_types_admin_write on public.meeting_types;
create policy meeting_types_read_all
on public.meeting_types
for select
using (public.is_read_user());

create policy meeting_types_admin_write
on public.meeting_types
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists leadership_meetings_admin_all on public.leadership_meetings;
drop policy if exists leadership_meetings_read_all on public.leadership_meetings;
drop policy if exists leadership_meetings_admin_write on public.leadership_meetings;
create policy leadership_meetings_read_all
on public.leadership_meetings
for select
using (public.is_read_user());

create policy leadership_meetings_admin_write
on public.leadership_meetings
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists leadership_items_admin_all on public.leadership_items;
drop policy if exists leadership_items_read_all on public.leadership_items;
drop policy if exists leadership_items_admin_write on public.leadership_items;
create policy leadership_items_read_all
on public.leadership_items
for select
using (public.is_read_user());

create policy leadership_items_admin_write
on public.leadership_items
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists chairboard_notes_chairboard_read on public.chairboard_notes;
drop policy if exists chairboard_notes_chairboard_write on public.chairboard_notes;
drop policy if exists chairboard_notes_personal_read on public.chairboard_notes;
drop policy if exists chairboard_notes_personal_write on public.chairboard_notes;

-- 회장단 공유 메모: 개인 메모([기타 메모] 접두어) 행은 제외한다.
create policy chairboard_notes_chairboard_read
on public.chairboard_notes
for select
using (public.is_chairboard_user() and coalesce(title, '') not like '[기타 메모]%');

create policy chairboard_notes_chairboard_write
on public.chairboard_notes
for all
using (public.is_chairboard_user() and coalesce(title, '') not like '[기타 메모]%')
with check (public.is_chairboard_user() and coalesce(title, '') not like '[기타 메모]%');

-- 개인 메모: 개인 메모 전용 사용자가 본인 소유 행만 접근한다.
create policy chairboard_notes_personal_read
on public.chairboard_notes
for select
using (
  public.is_personal_notes_user()
  and created_by = auth.uid()
  and coalesce(title, '') like '[기타 메모]%'
);

create policy chairboard_notes_personal_write
on public.chairboard_notes
for all
using (
  public.is_personal_notes_user()
  and created_by = auth.uid()
  and coalesce(title, '') like '[기타 메모]%'
)
with check (
  public.is_personal_notes_user()
  and created_by = auth.uid()
  and coalesce(title, '') like '[기타 메모]%'
);

drop policy if exists login_history_personal_read on public.login_history;
create policy login_history_personal_read
on public.login_history
for select
using (public.is_personal_notes_user());

-- ── 목표대비 달성(캠페인) RLS ──────────────────────────────────────────
alter table public.campaigns             enable row level security;
alter table public.campaign_participants enable row level security;
alter table public.campaign_counter_logs enable row level security;

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using (public.is_read_user());
drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns for all using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists camp_part_read on public.campaign_participants;
create policy camp_part_read on public.campaign_participants for select using (public.is_read_user());
drop policy if exists camp_part_write on public.campaign_participants;
create policy camp_part_write on public.campaign_participants for all using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists camp_counter_read on public.campaign_counter_logs;
create policy camp_counter_read on public.campaign_counter_logs for select using (public.is_read_user());
drop policy if exists camp_counter_write on public.campaign_counter_logs;
create policy camp_counter_write on public.campaign_counter_logs for all using (public.is_admin_user()) with check (public.is_admin_user());
