# Login Account Provisioning

This folder contains the internal provisioning flow for the 23 read-only login accounts.

## Recommended order

1. Run `04_seed_private_login_auth_users.mjs` on a trusted server with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LOGIN_INITIAL_PASSWORD`
2. Run `05_sync_private_login_public_users.sql` in the Supabase SQL Editor.
3. Run the smoke checks in `03_security_smoke_checks.sql`.

## Notes

- The auth seeding script uses the Supabase Auth Admin API, which is the official server-side method for creating users.
- The SQL step only syncs `auth.users` into `public.users` with `staff` role.
- The app treats `staff` and `viewer` as read-only roles.
- Admin accounts must be inserted into `public.users` explicitly by an operator. The app no longer auto-promotes the first login to `admin`.
- For the strongest security posture, apply `01_enable_readonly_roles.sql` to the production database so read-only users can rely on DB-enforced `select only` access.
- The internal email list itself stays in `private-login-accounts.md`, which is excluded from git.
