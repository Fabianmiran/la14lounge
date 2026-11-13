// [LA14 · PEDIDOS · v1] Prueba LOCAL de reserva de stock, cancelar y borrar cotizaciones (PGlite).
// No toca Supabase. Ejecutar: npx tsx scripts/test-pedidos-sql.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const db = new PGlite();
  let n = 0;
  const ok = (m: string) => { n++; console.log(`OK: ${m}`); };

  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
    create table public.products (id serial primary key, sku text, name text not null, brand text, size_ml int,
      sale_price int, active boolean default true);
    create table public.customers (id serial primary key, name text not null, phone text, whatsapp text);
    create table public.delivery_zones (id serial primary key, name text not null, fee_crc int not null default 0, free_over_crc int);
    create table public.orders (id serial primary key, customer_id int references public.customers(id), channel text not null default 'web',
      status text not null default 'nuevo', zone_id int references public.delivery_zones(id), delivery_fee int default 0,
      total_crc int not null default 0, payment_method text, paid boolean default false, age_checked_at_delivery boolean default false,
      created_at timestamptz default now(), delivered_at timestamptz);
    create table public.order_items (id serial primary key, order_id int not null references public.orders(id) on delete cascade,
      product_id int not null references public.products(id), qty int not null check (qty > 0), unit_price_crc int not null, unit_cost_crc int);
    create table public.stock_movements (id serial primary key, product_id int not null references public.products(id),
      qty int not null, reason text not null, ref_id int, created_at timestamptz default now(), note text);
    create table public.suppliers (id serial primary key, name text);
    create table public.supplier_prices (id serial primary key, supplier_id int, product_id int, cost_crc int not null,
      freight_crc int default 0, valid_from date default current_date);
    create view public.v_best_supplier as
      select distinct on (product_id) product_id, supplier_id, cost_crc + freight_crc as landed_cost_crc, valid_from
      from public.supplier_prices order by product_id, (cost_crc + freight_crc), valid_from desc;
    create function public.is_admin() returns boolean language sql stable
      as $$ select coalesce(current_setting('la14.admin', true), '') = 'on' $$;

    insert into public.customers (name) values ('Bar El Faro');
    insert into public.delivery_zones (name, fee_crc) values ('Heredia', 3000);
    insert into public.products (name, size_ml, sale_price) values ('Ron A', 750, 20000), ('Whisky B', 750, 30000);
    insert into public.supplier_prices (supplier_id, product_id, cost_crc) values (1, 1, 15000);
  `);

  for (const f of ["LA14_SQL_COTIZADOR_v1.sql", "LA14_SQL_PEDIDOS_v1.sql"]) {
    const sql = readFileSync(resolve(process.cwd(), "db", f), "utf8");
    await db.exec(sql);
    await db.exec(sql);
  }
  ok("Cotizador + Pedidos se aplican y se pueden repetir sin errores");

  await db.exec(`set la14.admin = 'on'`);
  const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) => (await db.query<T>(s, p)).rows;
  const fails = (fn: () => Promise<unknown>, re: RegExp) => assert.rejects(fn, (e: Error) => re.test(e.message));
  const stock = async (pid: number) =>
    (await q<{ on_hand: number; reserved: number; available: number }>(`select on_hand, reserved, available from public.v_stock_status where product_id=$1`, [pid]))[0];
  const cnt = async (t: string) => Number((await q<{ c: string }>(`select count(*)::int as c from public.${t}`))[0].c);
  const order = (items: unknown[]) =>
    q<{ id: number }>(`select public.create_order(1, null, 'manual', 'sinpe', $1::jsonb) as id`, [JSON.stringify(items)]).then((r) => r[0].id);
  const quote = async (items: unknown[]) =>
    (await q<{ id: string }>(`select public.create_quote(1, null, null, 7, null, $1::jsonb, 10) as id`, [JSON.stringify(items)]))[0].id;
  const compra = (pid: number, qty: number) =>
    q(`insert into public.stock_movements (product_id, qty, reason) values ($1,$2,'compra')`, [pid, qty]);

  // 1) Sin stock: se rechaza y no queda nada a medias
  await fails(() => order([{ product_id: 1, qty: 1 }]), /sin stock: Ron A \(disponible 0, pedido 1\)/);
  assert.equal(await cnt("orders"), 0);
  assert.equal(await cnt("order_items"), 0);
  ok("Sin stock: el pedido se bloquea con mensaje claro y no se crea nada");

  // 2) Con stock: reserva sin tocar lo físico
  await compra(1, 10);
  const o1 = await order([{ product_id: 1, qty: 4 }]);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 4, available: 6 });
  assert.equal(await cnt("stock_movements"), 1);
  ok("Pedido nuevo reserva 4: físico 10, reservado 4, disponible 6 (el libro de movimientos no cambia)");

  // 3) No se puede reservar más de lo disponible (incluye líneas repetidas)
  await fails(() => order([{ product_id: 1, qty: 7 }]), /sin stock/);
  await fails(() => order([{ product_id: 1, qty: 4 }, { product_id: 1, qty: 4 }]), /sin stock/);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 4, available: 6 });
  assert.equal(await cnt("orders"), 1);
  ok("No deja reservar más de lo disponible, ni repartiendo la cantidad en varias líneas");

  // 4) Un pedido sin stock en un producto no reserva los otros (todo o nada)
  await fails(() => order([{ product_id: 1, qty: 1 }, { product_id: 2, qty: 1 }]), /sin stock: Whisky B/);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 4, available: 6 });
  ok("Todo o nada: si falta un producto, ninguno se reserva");

  // 5) Estados abiertos siguen reservando
  await q(`select public.set_order_status($1,'confirmado')`, [o1]);
  await q(`select public.set_order_status($1,'en_ruta')`, [o1]);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 4, available: 6 });
  ok("Confirmado y en ruta siguen reservando");

  // 6) Cancelar libera la reserva y no toca lo físico
  await q(`select public.set_order_status($1,'cancelado')`, [o1]);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 0, available: 10 });
  assert.equal(await cnt("stock_movements"), 1);
  const au = await q<{ action: string; entity_id: string; actor: string }>(`select action, entity_id, actor from public.audit_log order by id`);
  assert.equal(au.at(-1)?.action, "pedido_cancelado");
  assert.equal(au.at(-1)?.entity_id, String(o1));
  assert.equal(au.at(-1)?.actor, "11111111-1111-1111-1111-111111111111");
  await fails(() => q(`select public.set_order_status($1,'en_ruta')`, [o1]), /cerrado/);
  ok("Cancelar libera la reserva, deja el físico igual y registra quién y qué liberó");

  // 7) Entregar: descuenta lo físico una sola vez y la reserva desaparece
  const o2 = await order([{ product_id: 1, qty: 3 }]);
  assert.deepEqual(await stock(1), { on_hand: 10, reserved: 3, available: 7 });
  await q(`select public.set_order_status($1,'entregado')`, [o2]);
  assert.deepEqual(await stock(1), { on_hand: 7, reserved: 0, available: 7 });
  const venta = await q<{ qty: number; ref_id: number }>(`select qty, ref_id from public.stock_movements where reason='venta'`);
  assert.deepEqual(venta, [{ qty: -3, ref_id: o2 }]);
  await fails(() => q(`select public.set_order_status($1,'entregado')`, [o2]), /cerrado/);
  assert.equal((await stock(1)).on_hand, 7);
  ok("Entregar descuenta lo físico una sola vez (disponible no se mueve) y queda ligado al pedido");

  // 8) Aceptar cotización reserva y registra
  const qa = await quote([{ product_id: 1, qty: 5 }]);
  assert.deepEqual(await stock(1), { on_hand: 7, reserved: 0, available: 7 }); // cotizar NO reserva
  const ord = (await q<{ o: number }>(`select public.accept_quote($1,'sinpe') as o`, [qa]))[0].o;
  assert.deepEqual(await stock(1), { on_hand: 7, reserved: 5, available: 2 });
  assert.equal((await q<{ status: string }>(`select status from public.quotes where id=$1`, [qa]))[0].status, "aceptada");
  const aq = await q<{ action: string; detail: { order_id: number } }>(`select action, detail from public.audit_log where entity_id=$1`, [qa]);
  assert.equal(aq[0].action, "cotizacion_aceptada");
  assert.equal(aq[0].detail.order_id, ord);
  ok("Cotizar no reserva; aceptar sí (5), crea el pedido y deja rastro en la bitácora");

  // 9) Aceptar sin stock suficiente: rechazado y nada cambia
  const qb = await quote([{ product_id: 1, qty: 3 }]); // disponible 2
  const ordersBefore = await cnt("orders");
  await fails(() => q(`select public.accept_quote($1)`, [qb]), /sin stock: Ron A \(disponible 2, pedido 3\)/);
  assert.equal(await cnt("orders"), ordersBefore);
  assert.equal((await q<{ status: string; order_id: number | null }>(`select status, order_id from public.quotes where id=$1`, [qb]))[0].status, "borrador");
  assert.deepEqual(await stock(1), { on_hand: 7, reserved: 5, available: 2 });
  ok("Aceptar sin stock se rechaza: la cotización sigue abierta, sin pedido y sin reserva");

  // 10) Cancelar el pedido de una cotización aceptada: stock libre y cotización 'cancelada'
  await q(`select public.set_order_status($1,'cancelado')`, [ord]);
  assert.deepEqual(await stock(1), { on_hand: 7, reserved: 0, available: 7 });
  assert.equal((await q<{ status: string }>(`select status from public.quotes where id=$1`, [qa]))[0].status, "cancelada");
  await fails(() => q(`select public.accept_quote($1)`, [qa]), /cerrada/);
  await fails(() => q(`select public.delete_quote($1)`, [qa]), /ya generó un pedido/);
  ok("Cancelar el pedido libera el stock, marca la cotización cancelada y no se puede reaceptar ni borrar");

  // 11) Borrar cotizaciones no aceptadas: desaparecen, sin cambios en inventario
  const snapshot = JSON.stringify({ s: await stock(1), m: await cnt("stock_movements"), o: await cnt("orders") });
  const qd = await quote([{ product_id: 1, qty: 2 }, { product_id: 2, qty: 1 }]);
  const num = (await q<{ quote_number: string }>(`select quote_number from public.quotes where id=$1`, [qd]))[0].quote_number;
  await q(`select public.delete_quote($1)`, [qd]);
  assert.equal(await cnt("quotes where id = '" + qd + "'"), 0);
  assert.equal(await cnt("quote_items where quote_id = '" + qd + "'"), 0);
  const ev = await q<{ detail: { quote_number: string } }>(`select detail from public.audit_log where action='cotizacion_borrada'`);
  assert.equal(ev.at(-1)?.detail.quote_number, num);
  const qe = await quote([{ product_id: 1, qty: 1 }]);
  await q(`select public.set_quote_status($1,'enviada')`, [qe]);
  await q(`select public.delete_quote($1)`, [qe]);
  const qr = await quote([{ product_id: 1, qty: 1 }]);
  await q(`select public.set_quote_status($1,'rechazada')`, [qr]);
  await q(`select public.delete_quote($1)`, [qr]);
  assert.equal(JSON.stringify({ s: await stock(1), m: await cnt("stock_movements"), o: await cnt("orders") }), snapshot);
  await fails(() => q(`select public.delete_quote($1)`, [qd]), /no existe/);
  ok("Borrar borrador/enviada/rechazada: se va con sus líneas, el inventario y los pedidos quedan idénticos, y queda registro");

  // 12) Seguridad
  await db.exec(`set la14.admin = 'off'`);
  await fails(() => q(`select public.delete_quote($1)`, [qa]), /no autorizado/);
  await fails(() => order([{ product_id: 1, qty: 1 }]), /no autorizado/);
  await db.exec(`set la14.admin = 'on'`);
  for (const fn of ["delete_quote(uuid)", "create_order(int,int,text,text,jsonb)", "accept_quote(uuid,text)"]) {
    const r = (await q<{ a: boolean; u: boolean }>(
      `select has_function_privilege('anon','public.${fn}','execute') as a, has_function_privilege('authenticated','public.${fn}','execute') as u`))[0];
    assert.equal(r.a, false, `anon no debe ejecutar ${fn}`);
    assert.equal(r.u, true);
  }
  for (const role of ["anon", "authenticated"]) {
    assert.equal((await q<{ x: boolean }>(`select has_function_privilege('${role}','public.assert_stock(jsonb)','execute') as x`))[0].x, false);
  }
  assert.equal((await q<{ x: boolean }>(`select relrowsecurity as x from pg_class where relname='audit_log'`))[0].x, true);
  assert.equal((await q<{ x: boolean }>(`select has_table_privilege('anon','public.audit_log','select') as x`))[0].x, false);
  assert.equal((await q<{ x: boolean }>(`select has_table_privilege('authenticated','public.audit_log','insert') as x`))[0].x, false);
  ok("Seguridad: no-admin rechazado; assert_stock interna; bitácora con RLS, solo lectura para admin");

  console.log(`\n${n} grupos de pruebas OK`);
}
main().catch((e) => { console.error("FALLÓ:", e); process.exit(1); });
