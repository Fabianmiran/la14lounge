// [LA14 · COTIZADOR · v1] app/admin/pedidos/cotizaciones/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { QUOTE_STATUS, isExpired } from "@/lib/cotizador";
import { createQuote } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const ERRORS: Record<string, string> = {
  vacio: "Agrega al menos un producto con cantidad.",
  linea: "Revisa las líneas: cada producto necesita cantidad (1 a 999) y un descuento entre 0 y 100.",
  vigencia: "La vigencia debe ser entre 1 y 60 días.",
  margen: "El margen mínimo debe estar entre 0 y 90.",
  guardar: "No se pudo crear. Revisa que los productos tengan precio de venta.",
};

type Q = { id: string; quote_number: string; customer_name: string | null; total_crc: number; status: string; valid_until: string; created_at: string };

export default async function Cotizaciones({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [cus, zon, prod, qs] = await Promise.all([
    supabase.from("customers").select("id, name").order("name").limit(500),
    supabase.from("delivery_zones").select("id, name").order("name"),
    supabase.from("products").select("id, name, size_ml, sale_price").eq("active", true).not("sale_price", "is", null).order("name"),
    supabase.from("quotes").select("id, quote_number, customer_name, total_crc, status, valid_until, created_at")
      .order("created_at", { ascending: false }).limit(50),
  ]);
  const customers = (cus.data ?? []) as { id: number; name: string }[];
  const zones = (zon.data ?? []) as { id: number; name: string }[];
  const products = (prod.data ?? []) as { id: number; name: string; size_ml: number; sale_price: number }[];
  const quotes = (qs.data ?? []) as Q[];

  return (
    <>
      <p className="font-mono text-xs text-ink-muted">
        <Link href="/admin/pedidos" className="hover:text-ink">← Pedidos</Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl">Cotizaciones</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Arma una cotización, mándala por WhatsApp o imprímela, y si el cliente acepta se convierte en pedido.
      </p>
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}

      {products.length === 0 && (
        <p className="mt-4 border border-rule p-3 text-sm text-ink-muted">
          Aún no hay productos activos con precio de venta. Cárgalos en el catálogo para poder cotizar.
        </p>
      )}

      <form action={createQuote} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
        <div>
          <p className={label}>Cliente registrado</p>
          <select name="customer_id" className={input} defaultValue="">
            <option value="">— otro / sin registrar —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <p className={label}>…o nombre (si no está registrado)</p>
          <input name="customer_name" maxLength={120} className={input} placeholder="Ej. Bar El Faro" />
        </div>
        <div>
          <p className={label}>Zona de entrega</p>
          <select name="zone_id" className={input} defaultValue="">
            <option value="">— sin envío —</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-3">
          <p className={label}>Productos (el precio lo toma el sistema · descuento en % por línea)</p>
          {Array.from({ length: 10 }, (_, k) => k + 1).map((i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
              <select name={`product_${i}`} className={input} defaultValue="">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.size_ml} ml · {colones(p.sale_price)}</option>
                ))}
              </select>
              <input name={`qty_${i}`} inputMode="numeric" placeholder="Cant." className={input} />
              <input name={`discount_${i}`} inputMode="decimal" placeholder="Desc. %" className={input} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={label}>Vigencia (días)</p>
            <input name="valid_days" inputMode="numeric" defaultValue="7" className={input} />
          </div>
          <div>
            <p className={label}>Margen mínimo %</p>
            <input name="min_margin" inputMode="decimal" defaultValue="10" className={input} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className={label}>Notas para el cliente (opcional)</p>
          <input name="notes" maxLength={500} className={input} placeholder="Ej. Entrega el viernes por la tarde" />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit">
          Crear cotización
        </button>
      </form>

      <ul className="mt-6 divide-y divide-rule">
        {quotes.length === 0 && <li className="py-4 text-ink-muted">Aún no hay cotizaciones.</li>}
        {quotes.map((q) => {
          const vencida = (q.status === "borrador" || q.status === "enviada") && isExpired(q.valid_until);
          return (
            <li key={q.id} className="py-4">
              <Link href={`/admin/pedidos/cotizaciones/${q.id}`} className="block hover:opacity-80">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg">{q.quote_number} · {q.customer_name ?? "Sin nombre"}</p>
                  <p className="font-mono text-lg">{colones(q.total_crc)}</p>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {QUOTE_STATUS[q.status] ?? q.status}
                  {vencida && <span className="text-alarm"> · vencida</span>}
                  {" · "}{new Date(q.created_at).toLocaleDateString("es-CR")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
