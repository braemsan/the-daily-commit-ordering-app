-- Globally pause new customer orders while leaving the public menu available.

alter table public.event_settings
  add column ordering_enabled boolean not null default true;

create or replace function public.set_ordering_enabled(p_ordering_enabled boolean)
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

  if p_ordering_enabled is null then
    raise exception using errcode = '22023', message = 'Ordering availability is required.';
  end if;

  update public.event_settings
  set ordering_enabled = p_ordering_enabled
  where id = 1
  returning * into strict v_settings;

  return jsonb_build_object(
    'ordering_enabled', v_settings.ordering_enabled,
    'updated_at', v_settings.updated_at
  );
end;
$$;

-- Preserve the established, server-authoritative ordering implementation behind
-- a locked availability gate. The row lock makes toggling and order creation
-- mutually exclusive, closing the check-to-insert race without consuming a number.
alter function public.place_order(text, text, jsonb, uuid)
  rename to place_order_unchecked;

revoke all on function public.place_order_unchecked(text, text, jsonb, uuid) from public;
revoke all on function public.place_order_unchecked(text, text, jsonb, uuid) from anon;
revoke all on function public.place_order_unchecked(text, text, jsonb, uuid) from authenticated;

create function public.place_order(
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
  v_ordering_enabled boolean;
begin
  select event_settings.ordering_enabled
  into strict v_ordering_enabled
  from public.event_settings
  where id = 1
  for share;

  if not v_ordering_enabled then
    raise exception using
      errcode = 'P0001',
      message = 'ORDERING_CLOSED: Ordering is currently closed.';
  end if;

  return query
  select result.order_number, result.tracking_token, result.order_total, result.was_duplicate
  from public.place_order_unchecked(
    p_customer_name,
    p_customer_notes,
    p_items,
    p_idempotency_key
  ) as result;
end;
$$;

revoke all on function public.set_ordering_enabled(boolean) from public;
revoke all on function public.set_ordering_enabled(boolean) from anon;
revoke all on function public.set_ordering_enabled(boolean) from authenticated;
grant execute on function public.set_ordering_enabled(boolean) to authenticated;

revoke all on function public.place_order(text, text, jsonb, uuid) from public;
revoke all on function public.place_order(text, text, jsonb, uuid) from anon;
revoke all on function public.place_order(text, text, jsonb, uuid) from authenticated;
grant execute on function public.place_order(text, text, jsonb, uuid) to anon, authenticated;
