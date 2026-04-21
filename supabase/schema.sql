-- YoungAdult Check App: MVP Schema
-- PostgreSQL / Supabase

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role text not null default 'admin' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null check (gender in ('형제', '자매')),
  birth_year integer not null check (birth_year between 1900 and 2100),
  salvation_date date,
  phone text,
  department_id bigint not null references public.departments(id),
  is_active boolean not null default true,
  is_newcomer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newcomer_profiles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  inviter_name text,
  notes text,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_type_id bigint not null references public.meeting_types(id),
  meeting_date date not null,
  title text not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_type_id, meeting_date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  member_id uuid not null references public.members(id),
  status text not null check (status in ('정상출석', '지각', '결석', '행사')),
  note text,
  checked_by uuid references public.users(id),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, member_id)
);

-- indexes
create index if not exists idx_users_role_active on public.users(role, is_active);
create index if not exists idx_departments_is_active on public.departments(is_active);
create index if not exists idx_members_name on public.members(name);
create index if not exists idx_members_gender on public.members(gender);
create index if not exists idx_members_department_id on public.members(department_id);
create index if not exists idx_members_is_active on public.members(is_active);
create index if not exists idx_members_is_newcomer on public.members(is_newcomer);
create index if not exists idx_newcomer_profiles_registered_at on public.newcomer_profiles(registered_at desc);
create index if not exists idx_meeting_types_is_active on public.meeting_types(is_active);
create index if not exists idx_meetings_date on public.meetings(meeting_date desc);
create index if not exists idx_meetings_type_date on public.meetings(meeting_type_id, meeting_date desc);
create index if not exists idx_attendance_records_meeting_id on public.attendance_records(meeting_id);
create index if not exists idx_attendance_records_member_id on public.attendance_records(member_id);
create index if not exists idx_attendance_records_status on public.attendance_records(status);

-- updated_at triggers
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create trigger trg_members_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger trg_newcomer_profiles_updated_at
before update on public.newcomer_profiles
for each row execute function public.set_updated_at();

create trigger trg_meeting_types_updated_at
before update on public.meeting_types
for each row execute function public.set_updated_at();

create trigger trg_meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create trigger trg_attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

-- RLS Draft / Baseline
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

alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.members enable row level security;
alter table public.newcomer_profiles enable row level security;
alter table public.meeting_types enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance_records enable row level security;

create policy users_admin_all
on public.users
for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy departments_admin_all
on public.departments
for all
using (public.is_admin_user())
with check (public.is_admin_user());

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

create policy meeting_types_admin_all
on public.meeting_types
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
