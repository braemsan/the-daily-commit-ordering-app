-- One-time bootstrap for the first administrator in this Supabase project.
-- On other environments, this is a safe no-op when the Auth UUID does not exist.

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
where users.id = 'c896ceb9-d085-441d-8caf-beb8d2450800'
on conflict (user_id) do update
set role = 'admin'::public.staff_role,
    is_active = true;
