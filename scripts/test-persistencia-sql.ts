// [LA14 · PERSISTENCIA · v1] Prueba LOCAL de la migración SQL.
// Usa una base PostgreSQL en memoria (PGlite) con el mismo esquema de producción.
// No hace consultas a tiendas ni toca Supabase.
// Ejecutar: npx tsx scripts/test-persistencia-sql.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
const db = new PGlite();
let passed = 0;
const ok = (name: string) => { passed++; console.log(`OK: ${name}`); };

// ---- Esquema de producción (tal como lo informó Supabase) ----
await db.exec(`
  create role anon; create role authenticated;
  create table public.products (id serial primary key, name text);
  create table public.competitors (id serial primary key, name text not null, channel text, url text);
  create table public.competitor_searches (
    id uuid primary key default gen_random_uuid(), query text not null, results_count int default 0,
    searched_at timestamptz not null default now(), normalized_query text, duration_ms int, source_status jsonb);
  create table public.competitor_products (
    id uuid primary key default gen_random_uuid(),
    competitor_id int not null references public.competitors(id) on delete cascade,
    external_id text, sku text, ean text, name text not null, brand text, presentation text, product_url text,
    current_price numeric, previous_price numeric, available boolean default true, promotion boolean default false,
    last_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    normalized_key text, name_raw text, size_ml int, pack_count int default 1, compare_price numeric,
    promo_pct numeric, promo_text text, last_seen_at timestamptz, catalog_product_id int);
  create index idx_competitor_products_competitor_url on public.competitor_products (competitor_id, product_url);
  create table public.competitor_price_history (
    id uuid primary key default gen_random_uuid(),
    competitor_product_id uuid not null references public.competitor_products(id) on delete cascade,
    price numeric not null, previous_price numeric, available boolean, promotion boolean default false,
    discount_percent numeric, checked_at timestamptz not null default now(),
    search_id uuid references public.competitor_searches(id) on delete set null,
    compare_price numeric, promo_pct numeric, captured_source text);
  -- Sustituto de is_admin(): 'on' = administrador con 2FA.
  create function public.is_admin() returns boolean language sql stable
    as $$ select coalesce(current_setting('la14.admin', true), '') = 'on' $$;
  insert into public.competitors (name, channel) values ('Walmart','web'),('Mega Súper','web');
  insert into public.products (name) values ('demo');
`);

const migration = readFileSync(resolve(process.cwd(), "db/LA14_SQL_PERSISTENCIA_v1.sql"), "utf8");
await db.exec(migration);
await db.exec(migration); // debe poder correrse dos veces
ok("La migración se aplica y se puede repetir sin errores");

await db.exec(`set la14.admin = 'on'`);

const MEGA = 2;
const mk = (n: number, over: Record<string, unknown> = {}) => ({
  competitor_id: MEGA, product_url: `https://www.megasuper.com/p/producto-${n}`, name: `Producto ${n} 750 ML`,
  brand: "Jack Daniels", size_ml: 750, pack_count: 1, normalized_key: `jack daniels|v${n}|750`,
  presentation: "750 ml", price: 28000 + n, compare_price: null, available: true, promo_pct: null, promo_text: null, ...over,
});
type Summary = { created: number; updated: number; unchanged: number; observations: number; skipped: number };
const rec = async (items: unknown[], search: string | null = null): Promise<Summary> => {
  const r = await db.query<{ s: Summary }>(`select public.record_competitor_observations($1::uuid, $2::jsonb) as s`, [search, JSON.stringify(items)]);
  return r.rows[0].s;
};
const count = async (t: string) => Number((await db.query<{ c: string }>(`select count(*)::int as c from public.${t}`)).rows[0].c);

// 1) Primera pasada
let items = [1, 2, 3, 4, 5].map((n) => mk(n));
assert.deepEqual(await rec(items), { created: 5, updated: 0, unchanged: 0, observations: 5, skipped: 0 });
assert.equal(await count("competitor_products"), 5);
assert.equal(await count("competitor_price_history"), 5);
ok("Primera pasada: 5 productos y 5 observaciones");

// 2) Segunda pasada idéntica: no duplica nada
assert.deepEqual(await rec(items), { created: 0, updated: 0, unchanged: 5, observations: 0, skipped: 0 });
assert.equal(await count("competitor_products"), 5);
assert.equal(await count("competitor_price_history"), 5);
ok("Segunda pasada idéntica: cero duplicados y cero observaciones nuevas");

// 3) Cambia el precio de uno: queda el precio anterior y una observación nueva
items = [mk(1, { price: 27000 }), ...[2, 3, 4, 5].map((n) => mk(n))];
assert.deepEqual(await rec(items), { created: 0, updated: 1, unchanged: 4, observations: 1, skipped: 0 });
let row = (await db.query<{ current_price: string; previous_price: string }>(
  `select current_price, previous_price from public.competitor_products where product_url like '%producto-1'`)).rows[0];
assert.equal(Number(row.current_price), 27000);
assert.equal(Number(row.previous_price), 28001);
assert.equal(await count("competitor_price_history"), 6);
ok("Cambio de precio: guarda precio anterior y 1 observación");

// 4) Cambia solo la disponibilidad
items[1] = mk(2, { available: false });
assert.equal((await rec(items)).observations, 1);
ok("Cambio de disponibilidad: 1 observación");

// 5) Llega un dato SIN precio: no pisa el último precio válido ni ensucia el historial
const before = await count("competitor_price_history");
const noPrice = await rec([mk(3, { price: null })]);
assert.equal(noPrice.observations, 0);
row = (await db.query<{ current_price: string; previous_price: string }>(
  `select current_price, previous_price from public.competitor_products where product_url like '%producto-3'`)).rows[0];
assert.equal(Number(row.current_price), 28003);
assert.equal(await count("competitor_price_history"), before);
ok("Dato sin precio: se conserva el último precio válido");

// 6) Promoción: el precio "antes" solo vale si es mayor
await rec([mk(4, { price: 25000, compare_price: 28000, promo_pct: 11 })]);
row = (await db.query<{ current_price: string; previous_price: string }>(
  `select current_price, compare_price as previous_price from public.competitor_products where product_url like '%producto-4'`)).rows[0];
assert.equal(Number(row.previous_price), 28000);
await rec([mk(5, { price: 28005, compare_price: 20000, promo_pct: 40 })]); // "antes" menor que el precio: se ignora
const bad = (await db.query<{ compare_price: string | null; promo_pct: string | null }>(
  `select compare_price, promo_pct from public.competitor_products where product_url like '%producto-5'`)).rows[0];
assert.equal(bad.compare_price, null);
assert.equal(bad.promo_pct, null);
ok("Promoción: precio anterior inválido se descarta");

// 7) Repetidos dentro del mismo lote y datos inválidos
const dup = await rec([mk(9), mk(9), mk(10, { product_url: "ftp://malo" }), mk(11, { product_url: "" }), { competitor_id: null }]);
assert.equal(dup.created, 1);
assert.equal(dup.skipped, 3);
ok("Repetidos en el lote y URLs inválidas: 1 creado, 3 omitidos");

// 8) El índice único impide duplicados escritos por otra vía
await assert.rejects(
  db.query(`insert into public.competitor_products (competitor_id, name, product_url) values (2, 'x', 'https://www.megasuper.com/p/producto-1')`),
  /duplicate key|unique/i,
);
ok("Índice único tienda + URL: bloquea duplicados");

// 9) Todo o nada: un lote con un dato imposible no deja nada a medias
const antes = { p: await count("competitor_products"), h: await count("competitor_price_history") };
await assert.rejects(rec([mk(20), mk(21, { available: "banana" })]));
assert.equal(await count("competitor_products"), antes.p);
assert.equal(await count("competitor_price_history"), antes.h);
ok("Atomicidad: un lote con error no guarda nada");

// 10) Pulso: si pasaron más de 7 días sin observación, registra una nueva aunque nada cambie
await db.exec(`update public.competitor_price_history set checked_at = now() - interval '8 days'`);
assert.equal((await rec([mk(2, { available: false })])).observations, 1);
ok("Pulso semanal: registra observación tras 8 días sin cambios");

// 11) Seguridad: sin ser administrador no ejecuta
await db.exec(`set la14.admin = 'off'`);
await assert.rejects(rec([mk(1)]), /no autorizado/);
ok("Sin permisos de administrador: rechazado");

console.log(`\n${passed} pruebas superadas. Consultas externas: 0. Escrituras en Supabase: 0.`);
}

main().catch((error: unknown) => {
  console.error("FALLÓ:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
