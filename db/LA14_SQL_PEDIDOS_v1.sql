-- [LA14 · PEDIDOS · v1] SQL  (requiere haber corrido antes LA14_SQL_COTIZADOR_v1)
-- Supabase > SQL Editor > New query (nómbrala LA14_SQL_PEDIDOS_v1) > pegar todo > Run.
-- Se puede correr varias veces sin romper nada.
--
-- Regla de inventario (reserva):
--   * El stock FÍSICO (stock_movements) solo cambia con hechos reales: compra, merma, ajuste y entrega.
--   * Un pedido abierto (nuevo, confirmado, en_ruta) RESERVA sus botellas. Disponible = físico - reservado.
--   * Aceptar una cotización o crear un pedido exige stock disponible; si no alcanza, se rechaza y no cambia nada.
--   * Cancelar un pedido libera la reserva sola (no hay que "devolver" nada). Entregar descuenta lo físico.
--   * Borrar una cotización que no se aceptó no toca el inventario. Todo queda en audit_log.

-- 1) Bitácora de auditoría (solo lectura para el administrador; la escriben las funciones)
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     uuid,
  action    text not null,
  entity    text not null,
  entity_id text,
  detail    jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists "admin lee" on public.audit_log;
create policy "admin lee" on public.audit_log for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- 2) Nuevo estado de cotización: cancelada (se cancela el pedido que salió de ella)
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('borrador','enviada','aceptada','rechazada','cancelada'));

-- 3) Existencias: físico, reservado y disponible (solo administrador)
create or replace view public.v_stock_status with (security_invoker = true) as
select p.id as product_id,
       coalesce((select sum(m.qty) from public.stock_movements m where m.product_id = p.id), 0)::int as on_hand,
       coalesce((select sum(oi.qty) from public.order_items oi join public.orders o on o.id = oi.order_id
                  where oi.product_id = p.id and o.status in ('nuevo','confirmado','en_ruta')), 0)::int as reserved,
       (coalesce((select sum(m.qty) from public.stock_movements m where m.product_id = p.id), 0)
        - coalesce((select sum(oi.qty) from public.order_items oi join public.orders o on o.id = oi.order_id
                     where oi.product_id = p.id and o.status in ('nuevo','confirmado','en_ruta')), 0))::int as available
from public.products p;
revoke all on public.v_stock_status from anon;
grant select on public.v_stock_status to authenticated;

-- 4) Verificación de stock con bloqueo (interna: solo la llaman las funciones de abajo)
create or replace function public.assert_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record; v_hand int; v_res int; v_name text;
begin
  for r in
    select (e->>'product_id')::int as pid, sum((e->>'qty')::int) as q
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if r.pid is null or r.q is null or r.q < 1 then raise exception 'cantidad inválida'; end if;
    -- Bloquea el producto para que dos pedidos a la vez no vendan la misma botella.
    select name into v_name from public.products where id = r.pid for update;
    if v_name is null then raise exception 'producto no existe'; end if;
    select coalesce(sum(qty), 0) into v_hand from public.stock_movements where product_id = r.pid;
    select coalesce(sum(oi.qty), 0) into v_res
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.product_id = r.pid and o.status in ('nuevo','confirmado','en_ruta');
    if v_hand - v_res < r.q then
      raise exception 'sin stock: % (disponible %, pedido %)', v_name, greatest(v_hand - v_res, 0), r.q;
    end if;
  end loop;
end $$;
revoke all on function public.assert_stock(jsonb) from public, anon, authenticated;

-- 5) Pedido directo: ahora reserva stock
create or replace function public.create_order(
  p_customer int, p_zone int, p_channel text, p_payment text, p_items jsonb
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order int; v_total int := 0; v_fee int := 0; v_free int;
  it jsonb; v_pid int; v_qty int; v_price int; v_cost int;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if p_channel not in ('web','whatsapp','manual') then raise exception 'canal inválido'; end if;
  if p_payment is not null and p_payment not in ('sinpe','efectivo','tarjeta') then
    raise exception 'método de pago inválido';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'el pedido no tiene productos';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 999 then raise exception 'cantidad inválida'; end if;
  end loop;

  perform public.assert_stock(p_items);

  insert into public.orders (customer_id, channel, zone_id, payment_method, status)
  values (p_customer, p_channel, p_zone, p_payment, 'nuevo')
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::int;
    v_qty := (it->>'qty')::int;
    select sale_price into v_price from public.products where id = v_pid and active;
    if v_price is null then raise exception 'producto inactivo o sin precio de venta'; end if;
    select landed_cost_crc into v_cost from public.v_best_supplier where product_id = v_pid;
    insert into public.order_items (order_id, product_id, qty, unit_price_crc, unit_cost_crc)
    values (v_order, v_pid, v_qty, v_price, v_cost);
    v_total := v_total + v_price * v_qty;
  end loop;

  if p_zone is not null then
    select fee_crc, free_over_crc into v_fee, v_free from public.delivery_zones where id = p_zone;
    if v_free is not null and v_total >= v_free then v_fee := 0; end if;
  end if;

  update public.orders
     set delivery_fee = coalesce(v_fee, 0), total_crc = v_total + coalesce(v_fee, 0)
   where id = v_order;
  return v_order;
end $$;

-- 6) Estados del pedido: cancelar libera la reserva y deja rastro; entregar descuenta lo físico
create or replace function public.set_order_status(p_order int, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if p_status not in ('confirmado','en_ruta','entregado','cancelado') then
    raise exception 'estado inválido';
  end if;

  select status into v_old from public.orders where id = p_order for update;
  if v_old is null then raise exception 'pedido no existe'; end if;
  if v_old in ('entregado','cancelado') then raise exception 'el pedido ya está cerrado'; end if;

  if p_status = 'entregado' then
    insert into public.stock_movements (product_id, qty, reason, ref_id, note)
    select product_id, -qty, 'venta', p_order, 'Pedido #' || p_order from public.order_items where order_id = p_order;
    update public.orders
       set status = 'entregado', delivered_at = now(), age_checked_at_delivery = true
     where id = p_order;
  elsif p_status = 'cancelado' then
    update public.orders set status = 'cancelado' where id = p_order;
    update public.quotes set status = 'cancelada' where order_id = p_order and status = 'aceptada';
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'pedido_cancelado', 'order', p_order::text,
            jsonb_build_object('estado_anterior', v_old,
              'reserva_liberada', (select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty)), '[]'::jsonb)
                                     from public.order_items where order_id = p_order)));
  else
    update public.orders set status = p_status where id = p_order;
  end if;
end $$;

-- 7) Cotizaciones: cerrar también si está cancelada
create or replace function public.set_quote_status(p_quote uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if p_status not in ('enviada','rechazada') then raise exception 'estado inválido'; end if;
  select status into v_old from public.quotes where id = p_quote for update;
  if v_old is null then raise exception 'cotización no existe'; end if;
  if v_old in ('aceptada','rechazada','cancelada') then raise exception 'la cotización ya está cerrada'; end if;
  update public.quotes set status = p_status where id = p_quote;
end $$;

-- 8) Aceptar cotización: exige stock disponible, crea el pedido (que reserva) y deja rastro
create or replace function public.accept_quote(p_quote uuid, p_payment text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare q public.quotes%rowtype; v_order int;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if p_payment is not null and p_payment not in ('sinpe','efectivo','tarjeta') then
    raise exception 'método de pago inválido';
  end if;
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null then raise exception 'cotización no existe'; end if;
  if q.status in ('aceptada','rechazada','cancelada') then raise exception 'la cotización ya está cerrada'; end if;
  if q.valid_until < (now() at time zone 'America/Costa_Rica')::date then
    raise exception 'la cotización está vencida';
  end if;
  if exists (select 1 from public.quote_items where quote_id = p_quote and product_id is null) then
    raise exception 'un producto de la cotización ya no existe; crea una cotización nueva';
  end if;

  perform public.assert_stock(
    (select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty))
       from public.quote_items where quote_id = p_quote));

  insert into public.orders (customer_id, channel, zone_id, payment_method, status, delivery_fee, total_crc)
  values (q.customer_id, 'manual', q.zone_id, p_payment, 'nuevo', q.delivery_fee, q.total_crc)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, unit_price_crc, unit_cost_crc)
  select v_order, product_id, qty, unit_price_crc, unit_cost_crc
    from public.quote_items where quote_id = p_quote and product_id is not null;

  update public.quotes set status = 'aceptada', order_id = v_order where id = p_quote;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), 'cotizacion_aceptada', 'quote', p_quote::text,
          jsonb_build_object('quote_number', q.quote_number, 'order_id', v_order, 'total_crc', q.total_crc));
  return v_order;
end $$;

-- 9) Borrar una cotización que NO se aceptó (no toca inventario; queda registro en la bitácora)
create or replace function public.delete_quote(p_quote uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare q public.quotes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null then raise exception 'cotización no existe'; end if;
  if q.status not in ('borrador','enviada','rechazada') then
    raise exception 'esta cotización ya generó un pedido; cancela el pedido en lugar de borrarla';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), 'cotizacion_borrada', 'quote', p_quote::text,
          jsonb_build_object('quote_number', q.quote_number, 'estado', q.status,
                             'customer_name', q.customer_name, 'total_crc', q.total_crc));
  delete from public.quotes where id = p_quote;
end $$;

revoke all on function public.create_order(int,int,text,text,jsonb) from public, anon;
revoke all on function public.set_order_status(int,text) from public, anon;
revoke all on function public.set_quote_status(uuid,text) from public, anon;
revoke all on function public.accept_quote(uuid,text) from public, anon;
revoke all on function public.delete_quote(uuid) from public, anon;
grant execute on function public.create_order(int,int,text,text,jsonb) to authenticated;
grant execute on function public.set_order_status(int,text) to authenticated;
grant execute on function public.set_quote_status(uuid,text) to authenticated;
grant execute on function public.accept_quote(uuid,text) to authenticated;
grant execute on function public.delete_quote(uuid) to authenticated;
