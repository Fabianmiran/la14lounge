// [LA14 · COTIZADOR · v1] Prueba LOCAL del SQL del cotizador (PGlite, base en memoria).
// No toca Supabase. Ejecutar: npx tsx scripts/test-cotizador-sql.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const db = new PGlite();
  let n = 0;
  const ok = (m: string) => { n++; console.log(`OK: ${m}`); };

  // Esquema de producción (tal como lo informó Supabase) + is_admin() simulado.
  await db.exec(`
    create role anon; create role authenticated;
    create table public.products (id serial primary key, sku text, name text not null, brand text, size_ml int,
      sale_price int, active boolean default true);
    create table public.customers (id serial primary key, name text not null, phone text, whatsapp text);
    create table public.delivery_zones (id serial primary key, name text not null, fee_crc int not null default 0, free_over_crc int);
    create table public.orders (id serial primary key, customer_id int references public.customers(id), channel text not null default 'web',
      status text not null default 'nuevo', zone_id int references public.delivery_zones(id), delivery_fee int default 0,
      total_crc int not null default 0, payment_method text, paid boolean default false, created_at timestamptz default now());
    create table public.order_items (id serial primary key, order_id int not null references public.orders(id) on delete cascade,
      product_id int not null references public.products(id), qty int not null check (qty > 0), unit_price_crc int not null, unit_cost_crc int);
    create table public.suppliers (id serial primary key, name text);
    create table public.supplier_prices (id serial primary key, supplier_id int, product_id int, cost_crc int not null,
      freight_crc int default 0, valid_from date default current_date);
    create view public.v_best_supplier as
      select distinct on (product_id) product_id, supplier_id, cost_crc + freight_crc as landed_cost_crc, valid_from
      from public.supplier_prices order by product_id, (cost_crc + freight_crc), valid_from desc;
    create function public.is_admin() returns boolean language sql stable
      as $$ select coalesce(current_setting('la14.admin', true), '') = 'on' $$;

    insert into public.customers (name, whatsapp) values ('Bar El Faro', '88887777');
    insert into public.delivery_zones (name, fee_crc, free_over_crc) values ('Heredia', 3000, 100000), ('Escazú', 4000, null);
    insert into public.products (name, brand, size_ml, sale_price, active) values
      ('Ron A 750', 'A', 750, 20000, true),      -- 1: costo 15000 -> margen 25%
      ('Whisky B 750', 'B', 750, 30000, true),   -- 2: sin costo conocido
      ('Vodka C 750', 'C', 750, 12000, true),    -- 3: costo 11000 -> margen 8.3% (bajo)
      ('Sin precio', 'D', 750, null, true),      -- 4
      ('Inactivo', 'E', 750, 9000, false);       -- 5
    insert into public.supplier_prices (supplier_id, product_id, cost_crc, freight_crc) values
      (1, 1, 14000, 1000), (1, 1, 16000, 0), (1, 3, 10500, 500);
  `);

  const sql = readFileSync(resolve(process.cwd(), "db/LA14_SQL_COTIZADOR_v1.sql"), "utf8");
  await db.exec(sql);
  await db.exec(sql);
  ok("El SQL se aplica y se puede repetir sin errores");

  await db.exec(`set la14.admin = 'on'`);
  const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) => (await db.query<T>(s, p)).rows;
  const create = async (items: unknown[], o: Partial<{ c: number | null; name: string | null; z: number | null; days: number; notes: string | null; m: number }> = {}) =>
    (await q<{ id: string }>(`select public.create_quote($1,$2,$3,$4,$5,$6::jsonb,$7) as id`,
      [o.c ?? null, o.name ?? null, o.z ?? null, o.days ?? 7, o.notes ?? null, JSON.stringify(items), o.m ?? 10]))[0].id;
  const fails = async (fn: () => Promise<unknown>, re: RegExp) => {
    await assert.rejects(fn, (e: Error) => re.test(e.message));
  };

  // 1) Cálculo: precios de la base, descuento por línea, envío
  let id = await create([{ product_id: 1, qty: 2, discount_pct: 10 }, { product_id: 2, qty: 1 }], { c: 1, z: 1 });
  let qt = (await q<{ subtotal_crc: number; delivery_fee: number; total_crc: number; quote_number: string; status: string; customer_name: string; zone_name: string }>(
    `select * from public.quotes where id=$1`, [id]))[0];
  // 20000*0.9=18000 x2 = 36000 + 30000 = 66000; envío 3000 (no llega a 100000)
  assert.equal(qt.subtotal_crc, 66000);
  assert.equal(qt.delivery_fee, 3000);
  assert.equal(qt.total_crc, 69000);
  assert.equal(qt.status, "borrador");
  assert.match(qt.quote_number, /^C-\d{4}$/);
  assert.equal(qt.customer_name, "Bar El Faro");
  assert.equal(qt.zone_name, "Heredia");
  ok("Totales: descuento por línea, subtotal, envío y total");

  // 2) Costo = mejor proveedor (14000+1000=15000) y margen
  let items = await q<{ product_id: number; unit_price_crc: number; unit_cost_crc: number | null; below_min_margin: boolean }>(
    `select product_id, unit_price_crc, unit_cost_crc, below_min_margin from public.quote_items where quote_id=$1 order by product_id`, [id]);
  assert.equal(items[0].unit_cost_crc, 15000);
  assert.equal(items[0].unit_price_crc, 18000);
  assert.equal(items[0].below_min_margin, false); // (18000-15000)/18000 = 16.7%
  assert.equal(items[1].unit_cost_crc, null);
  assert.equal(items[1].below_min_margin, false); // sin costo: no se puede alertar
  ok("Costo del mejor proveedor y sin alerta cuando el margen alcanza o no hay costo");

  // 3) Alerta de margen mínimo
  id = await create([{ product_id: 3, qty: 1 }]); // 12000 vs 11000 => 8.3% < 10
  items = await q(`select product_id, unit_price_crc, unit_cost_crc, below_min_margin from public.quote_items where quote_id=$1`, [id]);
  assert.equal(items[0].below_min_margin, true);
  id = await create([{ product_id: 3, qty: 1 }], { m: 5 });
  items = await q(`select product_id, unit_price_crc, unit_cost_crc, below_min_margin from public.quote_items where quote_id=$1`, [id]);
  assert.equal(items[0].below_min_margin, false);
  id = await create([{ product_id: 1, qty: 1, discount_pct: 30 }]); // 14000 vs 15000 => pérdida
  items = await q(`select product_id, unit_price_crc, unit_cost_crc, below_min_margin from public.quote_items where quote_id=$1`, [id]);
  assert.equal(items[0].below_min_margin, true);
  ok("Alerta de margen: bajo el mínimo, con otro mínimo y vendiendo bajo el costo");

  // 4) Envío gratis sobre el umbral de la zona
  id = await create([{ product_id: 2, qty: 4 }], { z: 1 }); // 120000 >= 100000
  qt = (await q<typeof qt>(`select * from public.quotes where id=$1`, [id]))[0];
  assert.equal(qt.delivery_fee, 0);
  assert.equal(qt.total_crc, 120000);
  ok("Envío gratis al superar el mínimo de la zona");

  // 5) Copia de precios: cambiar el catálogo después no altera la cotización
  const base = await create([{ product_id: 1, qty: 1 }]);
  await db.exec(`update public.products set sale_price = 99999, name = 'Otro nombre' where id = 1`);
  items = await q(`select name as product_id, unit_price_crc, unit_cost_crc, below_min_margin from public.quote_items where quote_id=$1`, [base]);
  assert.equal(items[0].unit_price_crc, 20000);
  assert.equal((items[0] as unknown as { product_id: string }).product_id, "Ron A 750");
  await db.exec(`update public.products set sale_price = 20000, name = 'Ron A 750' where id = 1`);
  ok("La cotización conserva nombre y precio de cuando se hizo");

  // 6) Validaciones: todo o nada
  const before = Number((await q<{ c: string }>(`select count(*)::int as c from public.quotes`))[0].c);
  await fails(() => create([]), /no tiene productos/);
  await fails(() => create([{ product_id: 4, qty: 1 }]), /sin precio/);
  await fails(() => create([{ product_id: 5, qty: 1 }]), /inactivo/);
  await fails(() => create([{ product_id: 999, qty: 1 }]), /inactivo|sin precio/);
  await fails(() => create([{ product_id: 1, qty: 0 }]), /cantidad/);
  await fails(() => create([{ product_id: 1, qty: 1000 }]), /cantidad/);
  await fails(() => create([{ product_id: 1, qty: 1, discount_pct: 101 }]), /descuento/);
  await fails(() => create([{ product_id: 1, qty: 1, discount_pct: -1 }]), /descuento/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { days: 0 }), /vigencia/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { days: 61 }), /vigencia/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { m: 91 }), /margen/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { c: 999 }), /cliente/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { z: 999 }), /zona/);
  await fails(() => create([{ product_id: 1, qty: 1 }], { notes: "x".repeat(501) }), /notas/);
  await fails(() => create(Array.from({ length: 31 }, () => ({ product_id: 1, qty: 1 }))), /máximo 30/);
  await fails(() => create([{ product_id: 1, qty: 1 }, { product_id: 4, qty: 1 }]), /sin precio/);
  const after = Number((await q<{ c: string }>(`select count(*)::int as c from public.quotes`))[0].c);
  assert.equal(after, before);
  ok("Entradas inválidas se rechazan y no dejan cotizaciones a medias");

  // 7) Estados
  id = await create([{ product_id: 1, qty: 1 }]);
  await q(`select public.set_quote_status($1,'enviada')`, [id]);
  assert.equal((await q<{ status: string }>(`select status from public.quotes where id=$1`, [id]))[0].status, "enviada");
  await fails(() => q(`select public.set_quote_status($1,'aceptada')`, [id]), /estado inválido/);
  await fails(() => q(`select public.set_quote_status($1,'borrador')`, [id]), /estado inválido/);
  await q(`select public.set_quote_status($1,'rechazada')`, [id]);
  await fails(() => q(`select public.set_quote_status($1,'enviada')`, [id]), /cerrada/);
  await fails(() => q(`select public.accept_quote($1)`, [id]), /cerrada/);
  ok("Estados: solo enviada/rechazada a mano; una rechazada queda cerrada");

  // 8) Aceptar -> crea pedido con precios y costos acordados
  id = await create([{ product_id: 1, qty: 3, discount_pct: 5 }, { product_id: 3, qty: 2 }], { c: 1, z: 2 });
  const quoteTotal = (await q<{ total_crc: number }>(`select total_crc from public.quotes where id=$1`, [id]))[0].total_crc;
  await db.exec(`update public.products set sale_price = 50000 where id = 1`); // el catálogo sube después
  const ord = (await q<{ o: number }>(`select public.accept_quote($1,'sinpe') as o`, [id]))[0].o;
  const order = (await q<{ total_crc: number; status: string; customer_id: number; payment_method: string; delivery_fee: number }>(
    `select * from public.orders where id=$1`, [ord]))[0];
  assert.equal(order.total_crc, quoteTotal);
  assert.equal(order.status, "nuevo");
  assert.equal(order.customer_id, 1);
  assert.equal(order.payment_method, "sinpe");
  assert.equal(order.delivery_fee, 4000);
  const oi = await q<{ product_id: number; qty: number; unit_price_crc: number; unit_cost_crc: number | null }>(
    `select product_id, qty, unit_price_crc, unit_cost_crc from public.order_items where order_id=$1 order by product_id`, [ord]);
  assert.deepEqual(oi, [
    { product_id: 1, qty: 3, unit_price_crc: 19000, unit_cost_crc: 15000 },
    { product_id: 3, qty: 2, unit_price_crc: 12000, unit_cost_crc: 11000 },
  ]);
  const sumItems = oi.reduce((a, r) => a + r.unit_price_crc * r.qty, 0) + order.delivery_fee;
  assert.equal(sumItems, order.total_crc);
  const acc = (await q<{ status: string; order_id: number }>(`select status, order_id from public.quotes where id=$1`, [id]))[0];
  assert.deepEqual(acc, { status: "aceptada", order_id: ord });
  await db.exec(`update public.products set sale_price = 20000 where id = 1`);
  ok("Aceptar crea el pedido con precios, costos y total de la cotización (no los del catálogo de hoy)");

  // 9) No se acepta dos veces
  await fails(() => q(`select public.accept_quote($1)`, [id]), /cerrada/);
  assert.equal(Number((await q<{ c: string }>(`select count(*)::int as c from public.orders`))[0].c), 1);
  ok("No se puede aceptar dos veces ni duplicar el pedido");

  // 10) Vencida
  id = await create([{ product_id: 1, qty: 1 }]);
  await db.exec(`update public.quotes set valid_until = (now() at time zone 'America/Costa_Rica')::date - 1 where id = '${id}'`);
  await fails(() => q(`select public.accept_quote($1)`, [id]), /vencida/);
  await db.exec(`update public.quotes set valid_until = (now() at time zone 'America/Costa_Rica')::date where id = '${id}'`);
  await q(`select public.accept_quote($1)`, [id]); // vence al final de hoy: aún sirve
  ok("Vencida no se acepta; el último día de vigencia todavía sirve");

  // 11) Pago inválido y producto borrado
  id = await create([{ product_id: 1, qty: 1 }]);
  await fails(() => q(`select public.accept_quote($1,'bitcoin')`, [id]), /pago/);
  await db.exec(`insert into public.products (name, size_ml, sale_price) values ('Temporal', 750, 5000)`);
  const tmp = (await q<{ id: number }>(`select id from public.products where name='Temporal'`))[0].id;
  id = await create([{ product_id: tmp, qty: 1 }]);
  await db.exec(`delete from public.products where id = ${tmp}`);
  await fails(() => q(`select public.accept_quote($1)`, [id]), /ya no existe/);
  ok("Pago inválido y producto borrado se rechazan");

  // 12) Seguridad
  await db.exec(`set la14.admin = 'off'`);
  await fails(() => create([{ product_id: 1, qty: 1 }]), /no autorizado/);
  await fails(() => q(`select public.set_quote_status($1,'enviada')`, [id]), /no autorizado/);
  await fails(() => q(`select public.accept_quote($1)`, [id]), /no autorizado/);
  await db.exec(`set la14.admin = 'on'`);
  for (const fn of ["create_quote(int,text,int,int,text,jsonb,numeric)", "set_quote_status(uuid,text)", "accept_quote(uuid,text)"]) {
    const r = (await q<{ a: boolean; u: boolean }>(
      `select has_function_privilege('anon','public.${fn}','execute') as a, has_function_privilege('authenticated','public.${fn}','execute') as u`))[0];
    assert.equal(r.a, false, `anon no debe ejecutar ${fn}`);
    assert.equal(r.u, true);
  }
  const rls = await q<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class where relname in ('quotes','quote_items') order by 1`);
  assert.ok(rls.length === 2 && rls.every((r) => r.relrowsecurity));
  const pol = await q<{ c: string }>(`select count(*)::int as c from pg_policies where tablename in ('quotes','quote_items')`);
  assert.equal(Number(pol[0].c), 2);
  assert.equal((await q<{ a: boolean }>(`select has_table_privilege('anon','public.quotes','select') as a`))[0].a, false);
  ok("Seguridad: no-admin rechazado, anon sin acceso, RLS activo en ambas tablas");

  console.log(`\n${n} grupos de pruebas OK`);
}
main().catch((e) => { console.error("FALLÓ:", e); process.exit(1); });
