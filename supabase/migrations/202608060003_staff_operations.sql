-- Phase 3 staff authentication, authorization, workflow, audit, and realtime support.

create type public.staff_role as enum ('admin', 'staff');

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role public.staff_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_status_audit (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.order_status not null,
  new_status public.order_status not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  check (previous_status <> new_status)
);

create index staff_profiles_active_idx on public.staff_profiles (is_active, role);
create index order_status_audit_order_changed_idx
  on public.order_status_audit (order_id, changed_at desc);
create index orders_order_date_created_idx on public.orders (order_date, created_at desc);
create index orders_customer_name_search_idx on public.orders (lower(customer_name));

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

alter table public.staff_profiles enable row level security;
alter table public.order_status_audit enable row level security;

create or replace function public.is_active_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = p_user_id and is_active
  );
$$;

create or replace function public.is_active_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = p_user_id and is_active and role = 'admin'
  );
$$;

revoke all on function public.is_active_staff(uuid) from public;
revoke all on function public.is_active_admin(uuid) from public;
grant execute on function public.is_active_staff(uuid) to authenticated;
grant execute on function public.is_active_admin(uuid) to authenticated;

create policy "Active staff can read own profile"
on public.staff_profiles for select
to authenticated
using (user_id = auth.uid() and is_active);

create policy "Active admins can read staff profiles"
on public.staff_profiles for select
to authenticated
using (public.is_active_admin(auth.uid()));

create policy "Active staff can read all menu items"
on public.menu_items for select
to authenticated
using (public.is_active_staff(auth.uid()));

create policy "Active staff can read orders"
on public.orders for select
to authenticated
using (public.is_active_staff(auth.uid()));

create policy "Active staff can read order items"
on public.order_items for select
to authenticated
using (public.is_active_staff(auth.uid()));

create policy "Active staff can read order audit"
on public.order_status_audit for select
to authenticated
using (public.is_active_staff(auth.uid()));

revoke all on public.staff_profiles from anon, authenticated;
revoke all on public.order_status_audit from anon, authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.order_status_audit to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status public.order_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_previous_status public.order_status;
begin
  if v_user_id is null or not public.is_active_staff(v_user_id) then
    raise exception using errcode = '42501', message = 'Active staff access is required.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found.';
  end if;

  if not (
    (v_order.status = 'new' and p_new_status in ('preparing', 'cancelled')) or
    (v_order.status = 'preparing' and p_new_status in ('ready', 'cancelled')) or
    (v_order.status = 'ready' and p_new_status in ('completed', 'cancelled'))
  ) then
    raise exception using errcode = '22023',
      message = format('Invalid order transition from %s to %s.', v_order.status, p_new_status);
  end if;

  v_previous_status := v_order.status;

  update public.orders
  set status = p_new_status
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_audit (
    order_id, previous_status, new_status, changed_by
  ) values (
    v_order.id,
    v_previous_status,
    p_new_status,
    v_user_id
  );

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'updated_at', v_order.updated_at
  );
end;
$$;

create or replace function public.update_menu_item(
  p_item_id bigint,
  p_name text,
  p_description text,
  p_price numeric,
  p_available boolean,
  p_category text,
  p_display_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.menu_items%rowtype;
begin
  if not public.is_active_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Active admin access is required.';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_name) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Name must be between 1 and 100 characters.';
  end if;
  if char_length(p_description) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'Description must be between 1 and 240 characters.';
  end if;
  if p_price is null or p_price < 0 or p_price > 99999999.99 then
    raise exception using errcode = '22023', message = 'Price must be zero or greater.';
  end if;
  if p_category not in ('Coffee', 'Chocolate') then
    raise exception using errcode = '22023', message = 'Invalid menu category.';
  end if;
  if p_display_order is null or p_display_order < 0 then
    raise exception using errcode = '22023', message = 'Display order must be zero or greater.';
  end if;

  update public.menu_items
  set name = p_name,
      description = p_description,
      price = p_price,
      available = p_available,
      category = p_category,
      display_order = p_display_order
  where id = p_item_id
  returning * into v_item;

  if not found then
    raise exception using errcode = 'P0002', message = 'Menu item not found.';
  end if;

  return to_jsonb(v_item);
end;
$$;

revoke all on function public.update_order_status(uuid, public.order_status) from public;
revoke all on function public.update_menu_item(bigint, text, text, numeric, boolean, text, integer) from public;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.update_menu_item(bigint, text, text, numeric, boolean, text, integer) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end;
$$;
