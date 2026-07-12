-- 전도/권유 카운터 로그에 인도자(leader_name)·대상자(target_name) 입력 필드 추가.
-- 재실행 안전(idempotent). Supabase SQL Editor에서 실행.

alter table public.campaign_counter_logs
  add column if not exists leader_name text,
  add column if not exists target_name text;
