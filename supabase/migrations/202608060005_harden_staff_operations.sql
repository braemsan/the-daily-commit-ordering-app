-- Preserve operational audit history when a former staff Auth user is deleted.

alter table public.order_status_audit
  drop constraint order_status_audit_changed_by_fkey;

alter table public.order_status_audit
  alter column changed_by drop not null;

alter table public.order_status_audit
  add constraint order_status_audit_changed_by_fkey
  foreign key (changed_by) references auth.users(id) on delete set null;

-- Return the complete updated order snapshot while retaining the locked,
-- database-enforced state machine and atomic audit insertion.
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
    v_order.id, v_previous_status, p_new_status, v_user_id
  );

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.update_order_status(uuid, public.order_status) from public;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
