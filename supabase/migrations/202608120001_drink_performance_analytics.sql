-- Aggregate drink performance for staff without transferring individual orders.
create or replace function public.get_drink_performance(
  p_start_date date,
  p_end_date date
)
returns table (
  drink_name text,
  cups_sold bigint,
  orders_count bigint,
  regular_value numeric,
  charged_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_staff(auth.uid()) then
    raise exception using errcode = '42501', message = 'Active staff access is required.';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception using errcode = '22007', message = 'A valid date range is required.';
  end if;

  return query
  select
    oi.item_name as drink_name,
    sum(oi.quantity)::bigint as cups_sold,
    count(distinct o.id)::bigint as orders_count,
    sum(oi.regular_unit_price * oi.quantity) as regular_value,
    sum(oi.unit_price * oi.quantity) as charged_value
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.order_date between p_start_date and p_end_date
    and o.status <> 'cancelled'
  group by oi.item_name
  order by cups_sold desc, drink_name asc;
end;
$$;

revoke all on function public.get_drink_performance(date, date) from public;
grant execute on function public.get_drink_performance(date, date) to authenticated;

