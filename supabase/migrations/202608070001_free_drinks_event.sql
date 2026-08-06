-- Temporary event pricing with server-authoritative regular and charged price snapshots.

create table public.event_settings (
  id smallint primary key default 1 check (id = 1),
  free_drinks_enabled boolean not null default false,
  event_title text not null check (char_length(btrim(event_title)) between 1 and 100),
  event_message text not null check (char_length(btrim(event_message)) between 1 and 300),
  paynow_number text not null check (char_length(btrim(paynow_number)) between 1 and 30),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger event_settings_set_updated_at
before update on public.event_settings
for each row execute function public.set_updated_at();

insert into public.event_settings (
  id, free_drinks_enabled, event_title, event_message, paynow_number
) values (
  1,
  true,
  'Today''s drinks are on us ☕',
  'Your coffee is completely FOC today ☕ But I won’t reject any amount sent via PayNow 😉 ',
  '87972700'
);

alter table public.orders
  add column regular_total numeric(10, 2) not null default 0 check (regular_total >= 0),
  add column free_drinks_applied boolean not null default false,
  add column event_title_snapshot text,
  add column event_message_snapshot text,
  add column paynow_number_snapshot text;

update public.orders set regular_total = total;

alter table public.order_items
  add column regular_unit_price numeric(10, 2) not null default 0
    check (regular_unit_price >= 0);

update public.order_items set regular_unit_price = unit_price;

alter table public.event_settings enable row level security;

create policy "Public can read event settings"
on public.event_settings for select
to anon, authenticated
using (id = 1);

revoke all on public.event_settings from anon, authenticated;
grant select on public.event_settings to anon, authenticated;

create or replace function public.update_event_settings(
  p_free_drinks_enabled boolean,
  p_event_title text,
  p_event_message text,
  p_paynow_number text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.event_settings%rowtype;
begin
  if not public.is_active_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Active admin access is required.';
  end if;

  p_event_title := btrim(coalesce(p_event_title, ''));
  p_event_message := btrim(coalesce(p_event_message, ''));
  p_paynow_number := btrim(coalesce(p_paynow_number, ''));

  if char_length(p_event_title) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Event title must be between 1 and 100 characters.';
  end if;
  if char_length(p_event_message) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'Event message must be between 1 and 300 characters.';
  end if;
  if char_length(p_paynow_number) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'PayNow number is required.';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception using errcode = '22023', message = 'Event end must be after its start.';
  end if;

  update public.event_settings
  set free_drinks_enabled = p_free_drinks_enabled,
      event_title = p_event_title,
      event_message = p_event_message,
      paynow_number = p_paynow_number,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where id = 1
  returning * into v_settings;

  return to_jsonb(v_settings);
end;
$$;

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
  v_settings public.event_settings%rowtype;
  v_quantity integer;
  v_sugar text;
  v_regular_total numeric(10, 2) := 0;
  v_charged_total numeric(10, 2) := 0;
  v_free_drinks_applied boolean := false;
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

  select * into strict v_settings from public.event_settings where id = 1;
  v_free_drinks_applied := v_settings.free_drinks_enabled
    and (v_settings.starts_at is null or now() >= v_settings.starts_at)
    and (v_settings.ends_at is null or now() < v_settings.ends_at);

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

    v_regular_total := v_regular_total + (v_menu.price * v_quantity);
  end loop;

  if not v_free_drinks_applied then
    v_charged_total := v_regular_total;
  end if;

  insert into public.daily_order_sequence as sequence (order_date, last_value)
  values (v_order_date, 1)
  on conflict (order_date) do update
    set last_value = sequence.last_value + 1, updated_at = now()
  returning last_value into v_daily_number;

  insert into public.orders (
    idempotency_key, order_date, daily_number, order_number,
    customer_name, customer_notes, total, regular_total, free_drinks_applied,
    event_title_snapshot, event_message_snapshot, paynow_number_snapshot
  ) values (
    p_idempotency_key, v_order_date, v_daily_number,
    'TDC-' || lpad(v_daily_number::text, 3, '0'),
    p_customer_name, p_customer_notes, v_charged_total, v_regular_total,
    v_free_drinks_applied,
    case when v_free_drinks_applied then v_settings.event_title end,
    case when v_free_drinks_applied then v_settings.event_message end,
    case when v_free_drinks_applied then v_settings.paynow_number end
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into strict v_menu from public.menu_items where id = (v_item ->> 'menu_item_id')::bigint;
    v_sugar := nullif(v_item ->> 'sugar_option', '');

    insert into public.order_items (
      order_id, menu_item_id, item_name, unit_price, regular_unit_price,
      quantity, sugar_option
    ) values (
      v_order.id, v_menu.id, v_menu.name,
      case when v_free_drinks_applied then 0 else v_menu.price end,
      v_menu.price, v_quantity, v_sugar
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
    'regular_total', orders.regular_total,
    'free_drinks_applied', orders.free_drinks_applied,
    'event_title', orders.event_title_snapshot,
    'event_message', orders.event_message_snapshot,
    'paynow_number', orders.paynow_number_snapshot,
    'created_at', orders.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', order_items.item_name,
        'quantity', order_items.quantity,
        'sugar_option', order_items.sugar_option,
        'unit_price', order_items.unit_price,
        'regular_unit_price', order_items.regular_unit_price,
        'line_total', order_items.line_total,
        'regular_line_total', order_items.regular_unit_price * order_items.quantity
      ) order by order_items.id)
      from public.order_items
      where order_items.order_id = orders.id
    ), '[]'::jsonb)
  )
  from public.orders
  where orders.tracking_token = p_tracking_token;
$$;

revoke all on function public.update_event_settings(boolean, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.update_event_settings(boolean, text, text, text, timestamptz, timestamptz) to authenticated;

revoke all on function public.place_order(text, text, jsonb, uuid) from public;
revoke all on function public.get_order_by_tracking_token(uuid) from public;
grant execute on function public.place_order(text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.get_order_by_tracking_token(uuid) to anon, authenticated;
