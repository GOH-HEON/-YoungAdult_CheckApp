-- YoungAdult Check App: seed data

-- 1) defaults: departments / meeting types
insert into public.departments (name, is_active)
values
  ('청년1부', true),
  ('청년2부', true),
  ('새가족부', true)
on conflict (name) do update set is_active = excluded.is_active;

insert into public.meeting_types (name, is_active)
values
  ('주일오후모임', true),
  ('금요기도모임', true),
  ('소그룹모임', true)
on conflict (name) do update set is_active = excluded.is_active;

-- 2) app users bootstrap (if corresponding auth user exists)
insert into public.users (id, email, name, role, is_active)
select au.id, au.email, '기본 관리자', 'admin', true
from auth.users au
where au.email = 'admin@example.com'
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    is_active = excluded.is_active;

-- 3) sample members
with dep as (
  select id, name from public.departments
),
rows as (
  select * from (
    values
      ('김형제', '형제', 1998, date '2015-03-01', '010-1111-1111', '청년1부', true, false),
      ('박자매', '자매', 2000, date '2017-05-12', '010-2222-2222', '청년1부', true, false),
      ('이형제', '형제', 1997, date '2012-11-20', '010-3333-3333', '청년2부', true, false),
      ('최자매', '자매', 2001, date '2018-09-03', '010-4444-4444', '청년2부', true, false),
      ('정새가족', '자매', 2002, null, '010-5555-5555', '새가족부', true, true)
  ) as t(name, gender, birth_year, salvation_date, phone, dep_name, is_active, is_newcomer)
)
insert into public.members (name, gender, birth_year, salvation_date, phone, department_id, is_active, is_newcomer)
select r.name, r.gender, r.birth_year, r.salvation_date, r.phone, d.id, r.is_active, r.is_newcomer
from rows r
join dep d on d.name = r.dep_name
where not exists (
  select 1 from public.members m where m.name = r.name and m.phone = r.phone
);

-- 4) newcomer profile for sample newcomer
insert into public.newcomer_profiles (member_id, inviter_name, notes)
select m.id, '장형제', '첫 방문 후 소그룹 연결 필요'
from public.members m
where m.name = '정새가족'
  and m.is_newcomer = true
  and not exists (select 1 from public.newcomer_profiles np where np.member_id = m.id);

-- 5) sample meeting + attendance
with mt as (
  select id, name from public.meeting_types where name = '주일오후모임' limit 1
),
admin_user as (
  select id from public.users where role = 'admin' and is_active = true order by created_at limit 1
),
target_meeting as (
  insert into public.meetings (meeting_type_id, meeting_date, title, created_by)
  select mt.id, current_date - interval '7 day', mt.name || ' 샘플', (select id from admin_user)
  from mt
  on conflict (meeting_type_id, meeting_date) do update set title = excluded.title
  returning id
)
insert into public.attendance_records (meeting_id, member_id, status, note, checked_by)
select tm.id, m.id,
  case
    when m.name in ('김형제', '박자매') then '정상출석'
    when m.name = '이형제' then '지각'
    when m.name = '최자매' then '결석'
    else '행사'
  end,
  null,
  (select id from admin_user)
from target_meeting tm
join public.members m on m.is_active = true
on conflict (meeting_id, member_id) do update
set status = excluded.status,
    note = excluded.note,
    checked_by = excluded.checked_by,
    checked_at = now();
