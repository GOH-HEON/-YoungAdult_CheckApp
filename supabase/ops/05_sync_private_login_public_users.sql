-- Sync Supabase Auth users into public.users as read-only viewer accounts.
-- Run after the auth users have been created by 04_seed_private_login_auth_users.mjs.

insert into public.users (id, email, name, role, is_active)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  case
    when au.email like 'hoejang%' then 'chairboard'
    else 'staff'
  end,
  true
from auth.users au
where au.email in (
  'somyeong1@youthhub.invalid',
  'somyeong2@youthhub.invalid',
  'somyeong3@youthhub.invalid',
  'somyeong4@youthhub.invalid',
  'bora1@youthhub.invalid',
  'bora2@youthhub.invalid',
  'bora3@youthhub.invalid',
  'bora4@youthhub.invalid',
  'ppuri1@youthhub.invalid',
  'ppuri2@youthhub.invalid',
  'ppuri3@youthhub.invalid',
  'ppuri4@youthhub.invalid',
  'eunhye1@youthhub.invalid',
  'eunhye2@youthhub.invalid',
  'eunhye3@youthhub.invalid',
  'eunhye4@youthhub.invalid',
  'jeondoin1@youthhub.invalid',
  'hoejang1@youthhub.invalid',
  'hoejang2@youthhub.invalid',
  'hoejang3@youthhub.invalid',
  'hoejang4@youthhub.invalid',
  'hoejang5@youthhub.invalid',
  'hoejang6@youthhub.invalid'
)
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  is_active = true,
  updated_at = now();

select email, role, is_active, updated_at
from public.users
where email in (
  'somyeong1@youthhub.invalid',
  'somyeong2@youthhub.invalid',
  'somyeong3@youthhub.invalid',
  'somyeong4@youthhub.invalid',
  'bora1@youthhub.invalid',
  'bora2@youthhub.invalid',
  'bora3@youthhub.invalid',
  'bora4@youthhub.invalid',
  'ppuri1@youthhub.invalid',
  'ppuri2@youthhub.invalid',
  'ppuri3@youthhub.invalid',
  'ppuri4@youthhub.invalid',
  'eunhye1@youthhub.invalid',
  'eunhye2@youthhub.invalid',
  'eunhye3@youthhub.invalid',
  'eunhye4@youthhub.invalid',
  'jeondoin1@youthhub.invalid',
  'hoejang1@youthhub.invalid',
  'hoejang2@youthhub.invalid',
  'hoejang3@youthhub.invalid',
  'hoejang4@youthhub.invalid',
  'hoejang5@youthhub.invalid',
  'hoejang6@youthhub.invalid'
)
order by email;
