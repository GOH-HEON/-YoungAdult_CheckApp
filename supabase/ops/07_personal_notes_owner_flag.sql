-- M1 fix: 개인 메모/접속 기록 접근 판정을 이름·이메일 부분 문자열 매칭에서
-- 전용 플래그(public.users.is_personal_notes_owner)로 전환한다.
-- 기존에는 name like '%고헌%' 또는 email localpart like '%goheon%' 로 판정해,
-- 이름이 "고헌수"이거나 이메일이 goheon2@... 인 계정이 개인 메모/전체 접속 기록에
-- 접근할 수 있었다. 이 마이그레이션은 정확 매칭 플래그를 도입하고, 현재 소유자에게만
-- 플래그를 부여한다. Supabase SQL Editor에서 실행. 여러 번 실행해도 안전(idempotent)하다.

begin;

-- 1) 플래그 컬럼 추가(기본 false = fail-closed).
alter table public.users
  add column if not exists is_personal_notes_owner boolean not null default false;

-- 2) 기존 판정식으로 현재 소유자를 1회 시딩(접근권 보존).
--    이후에는 이 플래그만 사용한다. 소유자를 바꾸려면 아래 UPDATE로 직접 지정한다.
update public.users u
set is_personal_notes_owner = true
where u.is_active = true
  and (
    coalesce(u.name, '') like '%고헌%'
    or split_part(lower(coalesce(u.email, '')), '@', 1) like '%goheon%'
    or split_part(lower(coalesce(u.email, '')), '@', 1) like '%gohheon%'
  );

-- 3) 판정 함수를 플래그 기반으로 재정의.
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

revoke all on function public.is_personal_notes_user() from public;
grant execute on function public.is_personal_notes_user() to authenticated;

commit;

-- 검증: 소유자로 지정된 계정 확인(1명이어야 정상).
-- select id, email, name, is_personal_notes_owner from public.users where is_personal_notes_owner;
--
-- 소유자를 명시적으로 지정/변경하려면:
-- update public.users set is_personal_notes_owner = (email = 'OWNER_EMAIL_HERE');
