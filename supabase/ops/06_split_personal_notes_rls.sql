-- H2 fix: 개인 메모(chairboard_notes 내 '[기타 메모]' 접두어 행)를 회장단 RLS에서 분리한다.
-- 기존 chairboard_notes_chairboard_read 정책은 is_chairboard_user() 전원에게 전체 행 SELECT를
-- 허용해, 회장단 권한 사용자가 자기 JWT로 REST API를 직접 호출하면 개인 메모를 읽을 수 있었다.
-- 이 마이그레이션은 회장단 정책에서 개인 메모 행을 제외하고, 개인 메모 전용 정책을 추가한다.
-- Supabase SQL Editor에서 실행. 여러 번 실행해도 안전(idempotent)하다.

begin;

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

commit;

-- 검증 쿼리(회장단 계정 JWT로 실행 시 개인 메모가 보이지 않아야 함):
-- select id, title from public.chairboard_notes where title like '[기타 메모]%';
