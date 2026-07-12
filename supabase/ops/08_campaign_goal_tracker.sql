-- 목표대비 달성: 캠페인 + 접수/참여 목록 + 전도/권유 카운터
-- 확정 결정: 단일 캠페인 · 전도/권유 전체 단일 카운터 · 목표는 지표별 전체 하나.
-- Supabase SQL Editor에서 실행. 재실행 안전(idempotent).

begin;

-- 1) campaigns: 캠페인 + 지표별 전체 목표(접수/참여/전도/권유)
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  goal_registration integer not null default 0 check (goal_registration >= 0),
  goal_participation integer not null default 0 check (goal_participation >= 0),
  goal_evangelism   integer not null default 0 check (goal_evangelism >= 0),
  goal_invitation   integer not null default 0 check (goal_invitation >= 0),
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) campaign_participants: 접수/참여 목록(분야 1). 캠페인당 1인 1행.
create table if not exists public.campaign_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  member_id uuid not null references public.members(id),
  registered boolean not null default false,
  participated boolean not null default false,
  registered_at timestamptz,
  participated_at timestamptz,
  note text,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  unique (campaign_id, member_id),
  constraint participated_requires_registered check (not participated or registered)
);
create index if not exists idx_camp_part_campaign on public.campaign_participants (campaign_id);

-- 3) campaign_counter_logs: 전도/권유 단일 카운터(분야 2·3). 달성 = sum(delta).
create table if not exists public.campaign_counter_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  metric text not null check (metric in ('전도','권유')),
  delta integer not null check (delta <> 0),
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_camp_counter_lookup on public.campaign_counter_logs (campaign_id, metric);

-- updated_at 트리거(기존 public.set_updated_at 재사용)
drop trigger if exists trg_campaigns_updated on public.campaigns;
create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();
drop trigger if exists trg_camp_part_updated on public.campaign_participants;
create trigger trg_camp_part_updated before update on public.campaign_participants
  for each row execute function public.set_updated_at();

-- RLS: 열람은 로그인 열람 권한 전원, 쓰기는 admin(기존 헬퍼 재사용)
alter table public.campaigns             enable row level security;
alter table public.campaign_participants enable row level security;
alter table public.campaign_counter_logs enable row level security;

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns
  for select using (public.is_read_user());
drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns
  for all using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists camp_part_read on public.campaign_participants;
create policy camp_part_read on public.campaign_participants
  for select using (public.is_read_user());
drop policy if exists camp_part_write on public.campaign_participants;
create policy camp_part_write on public.campaign_participants
  for all using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists camp_counter_read on public.campaign_counter_logs;
create policy camp_counter_read on public.campaign_counter_logs
  for select using (public.is_read_user());
drop policy if exists camp_counter_write on public.campaign_counter_logs;
create policy camp_counter_write on public.campaign_counter_logs
  for all using (public.is_admin_user()) with check (public.is_admin_user());

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- 시드(별도 실행): 캠페인 1건 + 155명 접수/참여 행. 목표: 접수155·참여155·전도45·권유150.
-- 155명 명단은 개인정보이므로 리포지토리에 값으로 커밋하지 않는다.
-- 아래는 "5개 부서 활성 멤버 전원"을 대상으로 하는 예시이며, 정확히 155명만 넣으려면
-- scripts/seed-campaign.mjs(서비스 롤 + 엑셀 (이름,부서) 매칭)로 실행한다.
--
-- insert into public.campaigns (name, description, start_date, end_date,
--   goal_registration, goal_participation, goal_evangelism, goal_invitation, is_active)
-- values ('2026 하계 전도캠페인', '청년회 여름 전도', '2026-07-01', '2026-08-31',
--   155, 155, 45, 150, true)
-- returning id;  -- :cid
--
-- insert into public.campaign_participants (campaign_id, member_id)
-- select :cid, m.id from public.members m
-- where m.is_active = true and m.department_id in (1,2,3,4,5)
-- on conflict (campaign_id, member_id) do nothing;
