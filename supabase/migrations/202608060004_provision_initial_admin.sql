-- Public template for the one-time administrator bootstrap.
-- This placeholder is intentionally a safe no-op. Provision the first administrator using the
-- environment-specific instructions in README.md instead of committing a real Auth UUID.

insert into public.staff_profiles (user_id, display_name, role, is_active)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(users.email, '@', 1), ''),
    'Booth Admin'
  ),
  'admin'::public.staff_role,
  true
from auth.users as users
where users.id = '00000000-0000-0000-0000-000000000000'
on conflict (user_id) do update
set role = 'admin'::public.staff_role,
    is_active = true;
