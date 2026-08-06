-- Phase 2 customer ordering baseline.
-- This replaces the insecure prototype schema. Apply to a new/staging project before production.

drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.daily_order_sequence cascade;
drop table if exists public.menu_items cascade;
drop sequence if exists public.order_number_seq cascade;
drop type if exists public.order_status cascade;

create type public.order_status as enum ('new', 'preparing', 'ready', 'completed', 'cancelled');

create table public.menu_items (
  id bigint generated always as identity primary key,
  category text not null check (category in ('Coffee', 'Chocolate')),
  name text not null unique check (char_length(name) between 1 and 100),
  description text not null check (char_length(description) between 1 and 240),
  price numeric(10, 2) not null check (price >= 0),
  requires_sugar boolean not null default false,
  available boolean not null default true,
  display_order integer not null check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_public_order_idx
  on public.menu_items (category, display_order)
  where available;

create table public.daily_order_sequence (
  order_date date primary key,
  last_value integer not null check (last_value > 0),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_token uuid not null unique default gen_random_uuid(),
  idempotency_key uuid not null unique,
  order_date date not null,
  daily_number integer not null check (daily_number > 0),
  order_number text not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 50),
  customer_notes text check (
    customer_notes is null or char_length(customer_notes) between 1 and 300
  ),
  status public.order_status not null default 'new',
  total numeric(10, 2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_date, daily_number),
  unique (order_date, order_number)
);

create index orders_status_created_at_idx on public.orders (status, created_at desc);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id bigint not null references public.menu_items(id),
  item_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20),
  sugar_option text check (sugar_option in ('sugar', 'no_sugar')),
  line_total numeric(10, 2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

insert into public.menu_items
  (category, name, description, price, requires_sugar, available, display_order)
values
  ('Coffee', 'Hot Americano', 'Rich espresso lengthened with hot water for a clean, bold finish.', 4.00, true, true, 10),
  ('Coffee', 'Hot Latte', 'Silky steamed milk poured over a balanced double espresso.', 5.00, true, true, 20),
  ('Coffee', 'Iced Americano', 'Double espresso over chilled water and ice; crisp and refreshing.', 4.50, true, true, 30),
  ('Coffee', 'Iced Latte', 'Creamy cold milk, espresso and ice in perfect balance.', 5.50, true, true, 40),
  ('Coffee', 'Iced Salted Caramel Latte', 'Espresso, cold milk and salted caramel with a smooth finish.', 6.50, false, true, 50),
  ('Coffee', 'Iced Mont-Blanc', 'A signature iced coffee crowned with a lightly sweet cream cap.', 6.50, false, true, 60),
  ('Coffee', 'Iced Espresso Tonic', 'Bright espresso layered over sparkling tonic and ice.', 6.00, false, true, 70),
  ('Coffee', 'Iced Mocha', 'Espresso and chocolate blended with cold milk over ice.', 6.00, false, true, 80),
  ('Chocolate', 'Hot Chocolate', 'Comforting cocoa whisked with velvety steamed milk.', 5.00, true, true, 90),
  ('Chocolate', 'Iced Chocolate', 'Deep cocoa and cold milk poured over ice.', 5.50, true, true, 100);

alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_order_sequence enable row level security;

create policy "Public can read available menu"
on public.menu_items for select
to anon, authenticated
using (available);

revoke all on public.menu_items from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.daily_order_sequence from anon, authenticated;
grant select on public.menu_items to anon, authenticated;

create or replace function public.place_order(
  p_customer_name text,
  p_customer_notes text,
  p_items jsonb,
  p_idempotency_key uuid
)
returns table (
  order_number text,
  tracking_token uuid,
  order_total numeric,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.orders%rowtype;
  v_item jsonb;
  v_menu public.menu_items%rowtype;
  v_quantity integer;
  v_sugar text;
  v_total numeric(10, 2) := 0;
  v_order_date date := (now() at time zone 'Asia/Singapore')::date;
  v_daily_number integer;
  v_order public.orders%rowtype;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.orders
  where idempotency_key = p_idempotency_key;

  if found then
    return query select v_existing.order_number, v_existing.tracking_token,
      v_existing.total, true;
    return;
  end if;

  p_customer_name := btrim(coalesce(p_customer_name, ''));
  p_customer_notes := nullif(btrim(coalesce(p_customer_notes, '')), '');

  if char_length(p_customer_name) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Customer name must be between 1 and 50 characters.';
  end if;
  if p_customer_notes is not null and char_length(p_customer_notes) > 300 then
    raise exception using errcode = '22023', message = 'Order remarks must be 300 characters or fewer.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'Order items must be an array.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'An order must contain between 1 and 50 line items.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'Every item must have a valid quantity.';
    end;
    if v_quantity is null or v_quantity not between 1 and 20 then
      raise exception using errcode = '22023', message = 'Item quantity must be between 1 and 20.';
    end if;

    select * into v_menu
    from public.menu_items
    where id = (v_item ->> 'menu_item_id')::bigint and available;
    if not found then
      raise exception using errcode = '22023', message = 'A selected menu item is unavailable.';
    end if;

    v_sugar := nullif(v_item ->> 'sugar_option', '');
    if v_menu.requires_sugar and (v_sugar is null or v_sugar not in ('sugar', 'no_sugar')) then
      raise exception using errcode = '22023', message = format('Select a sugar option for %s.', v_menu.name);
    end if;
    if not v_menu.requires_sugar and v_sugar is not null then
      raise exception using errcode = '22023', message = format('%s does not accept a sugar option.', v_menu.name);
    end if;

    v_total := v_total + (v_menu.price * v_quantity);
  end loop;

  insert into public.daily_order_sequence as sequence (order_date, last_value)
  values (v_order_date, 1)
  on conflict (order_date) do update
    set last_value = sequence.last_value + 1, updated_at = now()
  returning last_value into v_daily_number;

  insert into public.orders (
    idempotency_key, order_date, daily_number, order_number,
    customer_name, customer_notes, total
  ) values (
    p_idempotency_key, v_order_date, v_daily_number,
    'TDC-' || lpad(v_daily_number::text, 3, '0'),
    p_customer_name, p_customer_notes, v_total
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into strict v_menu from public.menu_items where id = (v_item ->> 'menu_item_id')::bigint;
    v_sugar := nullif(v_item ->> 'sugar_option', '');

    insert into public.order_items (
      order_id, menu_item_id, item_name, unit_price, quantity, sugar_option
    ) values (
      v_order.id, v_menu.id, v_menu.name, v_menu.price, v_quantity, v_sugar
    );
  end loop;

  return query select v_order.order_number, v_order.tracking_token, v_order.total, false;
end;
$$;

create or replace function public.get_order_by_tracking_token(p_tracking_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', orders.order_number,
    'customer_name', orders.customer_name,
    'customer_notes', orders.customer_notes,
    'status', orders.status,
    'total', orders.total,
    'created_at', orders.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', order_items.item_name,
        'quantity', order_items.quantity,
        'sugar_option', order_items.sugar_option,
        'unit_price', order_items.unit_price,
        'line_total', order_items.line_total
      ) order by order_items.id)
      from public.order_items
      where order_items.order_id = orders.id
    ), '[]'::jsonb)
  )
  from public.orders
  where orders.tracking_token = p_tracking_token;
$$;

revoke all on function public.place_order(text, text, jsonb, uuid) from public;
revoke all on function public.get_order_by_tracking_token(uuid) from public;
grant execute on function public.place_order(text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.get_order_by_tracking_token(uuid) to anon, authenticated;
