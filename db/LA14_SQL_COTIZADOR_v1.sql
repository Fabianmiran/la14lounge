-- [LA14 · COTIZADOR · v1] SQL
-- Supabase > SQL Editor > New query (nómbrala LA14_SQL_COTIZADOR_v1) > pegar todo > Run.
-- Se puede correr varias veces sin romper nada.
-- Los precios y costos los calcula SIEMPRE la base de datos, nunca el navegador.

create sequence if not exists public.quote_number_seq;

create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  quote_number   text not null unique
                 default ('C-' || lpad(nextval('public.quote_number_seq')::text, 4, '0')),
  customer_id    int references public.customers(id) on delete set null,
  customer_name  text,
  zone_id        int references public.delivery_zones(id) on delete set null,
  zone_name      text,
  delivery_fee   int not null default 0 check (delivery_fee >= 0),
  subtotal_crc   int not null default 0 check (subtotal_crc >= 0),
  total_crc      int not null default 0 check (total_crc >= 0),
  valid_until    date not null,
  notes          text check (notes is null or char_length(notes) <= 500),
  status         text not null default 'borrador'
                 check (status in ('borrador','enviada','aceptada','rechazada')),
  order_id       int references public.orders(id) on delete set null,
  min_margin_pct numeric(5,2) not null default 10 check (min_margin_pct between 0 and 90),
  created_at     timestamptz not null default now()
);

create table if not exists public.quote_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes(id) on delete cascade,
  product_id      int references public.products(id) on delete set null,
  name            text not null,              -- copia del nombre al cotizar
  size_ml         int,
  qty             int not null check (qty between 1 and 999),
  list_price_crc  int not null check (list_price_crc >= 0),
  discount_pct    numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  unit_price_crc  int not null check (unit_price_crc >= 0),
  unit_cost_crc   int,                        -- PRIVADO: nunca se muestra al cliente
  below_min_margin boolean not null default false
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);
create index if not exists quotes_created_idx on public.quotes (created_at desc);

-- Seguridad: solo el administrador (con 2FA) ve o toca cotizaciones.
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
drop policy if exists "admin total" on public.quotes;
drop policy if exists "admin total" on public.quote_items;
create policy "admin total" on public.quotes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.quote_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.quotes, public.quote_items from anon;
revoke all on sequence public.quote_number_seq from anon, authenticated;

-- Crear cotización. p_items = [{"product_id":1,"qty":2,"discount_pct":5}, ...]
create or replace function public.create_quote(
  p_customer int, p_customer_name text, p_zone int, p_valid_days int,
  p_notes text, p_items jsonb, p_min_margin numeric default 10
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote uuid; v_sub int := 0; v_fee int := 0; v_free int; v_zone_name text;
  v_cname text; it jsonb; v_pid int; v_qty int; v_disc numeric;
  v_name text; v_size int; v_list int; v_price int; v_cost int; v_below boolean;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then
    raise exception 'la cotización no tiene productos (máximo 30)';
  end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 60 then
    raise exception 'la vigencia debe ser entre 1 y 60 días';
  end if;
  if p_min_margin is null or p_min_margin < 0 or p_min_margin > 90 then
    raise exception 'margen mínimo inválido';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'las notas son muy largas';
  end if;

  v_cname := nullif(left(btrim(coalesce(p_customer_name, '')), 120), '');
  if p_customer is not null then
    select name into v_cname from public.customers where id = p_customer;
    if v_cname is null then raise exception 'cliente no existe'; end if;
  end if;

  if p_zone is not null then
    select name, fee_crc, free_over_crc into v_zone_name, v_fee, v_free
      from public.delivery_zones where id = p_zone;
    if v_zone_name is null then raise exception 'zona no existe'; end if;
  end if;

  insert into public.quotes (customer_id, customer_name, zone_id, notes, min_margin_pct, valid_until)
  values (p_customer, v_cname, p_zone, nullif(btrim(coalesce(p_notes, '')), ''), p_min_margin,
          (now() at time zone 'America/Costa_Rica')::date + p_valid_days)
  returning id into v_quote;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid  := (it->>'product_id')::int;
    v_qty  := (it->>'qty')::int;
    v_disc := coalesce((it->>'discount_pct')::numeric, 0);
    if v_qty is null or v_qty < 1 or v_qty > 999 then raise exception 'cantidad inválida'; end if;
    if v_disc < 0 or v_disc > 100 then raise exception 'descuento inválido'; end if;

    select name, size_ml, sale_price into v_name, v_size, v_list
      from public.products where id = v_pid and active;
    if v_list is null then raise exception 'producto inactivo o sin precio de venta'; end if;

    v_price := round(v_list * (100 - v_disc) / 100.0);
    select landed_cost_crc into v_cost from public.v_best_supplier where product_id = v_pid;
    v_below := v_cost is not null and v_price > 0
               and ((v_price - v_cost) * 100.0 / v_price) < p_min_margin;
    if v_cost is not null and v_price = 0 then v_below := true; end if;

    insert into public.quote_items
      (quote_id, product_id, name, size_ml, qty, list_price_crc, discount_pct,
       unit_price_crc, unit_cost_crc, below_min_margin)
    values (v_quote, v_pid, v_name, v_size, v_qty, v_list, v_disc, v_price, v_cost, v_below);
    v_sub := v_sub + v_price * v_qty;
  end loop;

  if p_zone is not null and v_free is not null and v_sub >= v_free then v_fee := 0; end if;

  update public.quotes
     set subtotal_crc = v_sub, delivery_fee = coalesce(v_fee, 0),
         total_crc = v_sub + coalesce(v_fee, 0), zone_name = v_zone_name
   where id = v_quote;
  return v_quote;
end $$;

-- Cambiar estado a mano: solo "enviada" o "rechazada".
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
  if v_old in ('aceptada','rechazada') then raise exception 'la cotización ya está cerrada'; end if;
  update public.quotes set status = p_status where id = p_quote;
end $$;

-- Aceptar: crea el pedido con los precios y costos acordados en la cotización.
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
  if q.status in ('aceptada','rechazada') then raise exception 'la cotización ya está cerrada'; end if;
  if q.valid_until < (now() at time zone 'America/Costa_Rica')::date then
    raise exception 'la cotización está vencida';
  end if;

  if exists (select 1 from public.quote_items where quote_id = p_quote and product_id is null) then
    raise exception 'un producto de la cotización ya no existe; crea una cotización nueva';
  end if;

  insert into public.orders (customer_id, channel, zone_id, payment_method, status, delivery_fee, total_crc)
  values (q.customer_id, 'manual', q.zone_id, p_payment, 'nuevo', q.delivery_fee, q.total_crc)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, unit_price_crc, unit_cost_crc)
  select v_order, product_id, qty, unit_price_crc, unit_cost_crc
    from public.quote_items where quote_id = p_quote and product_id is not null;

  update public.quotes set status = 'aceptada', order_id = v_order where id = p_quote;
  return v_order;
end $$;

revoke all on function public.create_quote(int,text,int,int,text,jsonb,numeric) from public, anon;
revoke all on function public.set_quote_status(uuid,text) from public, anon;
revoke all on function public.accept_quote(uuid,text) from public, anon;
grant execute on function public.create_quote(int,text,int,int,text,jsonb,numeric) to authenticated;
grant execute on function public.set_quote_status(uuid,text) to authenticated;
grant execute on function public.accept_quote(uuid,text) to authenticated;
