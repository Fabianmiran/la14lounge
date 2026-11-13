// [LA14 · PEDIDOS · v1] app/admin/pedidos/page.tsx (pantalla única: cotizaciones + pedidos)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { QUOTE_STATUS, isExpired } from "@/lib/cotizador";
import { changeStatus, markPaid } from "./actions";
import { FormCotizacion, FormPedido, type Opt, type Prod } from "./formularios";

const ERRORS: Record<string, string> = {
  vacio: "Agrega al menos un producto con cantidad.",
  linea: "Revisa las líneas: cada producto necesita cantidad (1 a 999) y un descuento entre 0 y 100.",
  vigencia: "La vigencia debe ser entre 1 y 60 días.",
  margen: "El margen mínimo debe estar entre 0 y 90.",
  edad: "Para entregar debes confirmar que verificaste la mayoría de edad.",
  stock: "No alcanza el inventario disponible.",
  guardar: "No se pudo completar. Revisa que los productos tengan precio de venta.",
};
const STATUS: Record<string, string> = {
  nuevo: "Nuevo", confirmado: "Confirmado", en_ruta: "En ruta", entregado: "Entregado", cancelado: "Cancelado",
};
const NEXT: Record<string, { to: string; text: string } | undefined> = {
  nuevo: { to: "confirmado", text: "Confirmar" },
  confirmado: { to: "en_ruta", text: "Enviar" },
  en_ruta: { to: "entregado", text: "Entregado" },
};
const VIEWS = ["cotizaciones", "porentregar", "entregados", "cerrados"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = {
  cotizaciones: "Cotizaciones", porentregar: "Por entregar", entregados: "Entregados", cerrados: "Cerrados",
};
const OPEN = ["nuevo", "confirmado", "en_ruta"];

type O = {
  id: number; status: string; total_crc: number; paid: boolean; created_at: string; channel: string;
  customers: { name: string } | null; order_items: { qty: number }[];
};
type Q = {
  id: string; quote_number: string; customer_name: string | null; total_crc: number; status: string;
  valid_until: string; created_at: string; order_id: number | null;
};

export default async function Pedidos({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; detalle?: string; v?: string; nuevo?: string; cancelar?: string }>;
}) {
  const sp = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(sp.v ?? "") ? (sp.v as View) : "cotizaciones";
  const nuevo = sp.nuevo === "cotizar" || sp.nuevo === "pedido" ? sp.nuevo : null;
  const cancelarId = /^\d{1,9}$/.test(sp.cancelar ?? "") ? Number(sp.cancelar) : null;
  const supabase = await createClient();

  const [cus, zon, prod, stk, ord, qts] = await Promise.all([
    nuevo ? supabase.from("customers").select("id, name").order("name").limit(500) : null,
    nuevo ? supabase.from("delivery_zones").select("id, name").order("name") : null,
    nuevo ? supabase.from("products").select("id, name, size_ml, sale_price").eq("active", true).order("name") : null,
    nuevo ? supabase.from("v_stock_status").select("product_id, available") : null,
    supabase.from("orders")
      .select("id, status, total_crc, paid, created_at, channel, customers(name), order_items(qty)")
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("quotes")
      .select("id, quote_number, customer_name, total_crc, status, valid_until, created_at, order_id")
      .order("created_at", { ascending: false }).limit(100),
  ]);

  const orders = (ord.data ?? []) as unknown as O[];
  const quotes = (qts.data ?? []) as Q[];
  const fromQuote = new Map(quotes.filter((q) => q.order_id).map((q) => [q.order_id as number, q.quote_number]));
  const available = new Map(((stk?.data ?? []) as { product_id: number; available: number }[]).map((s) => [s.product_id, s.available]));

  const isOpenQuote = (q: Q) => (q.status === "borrador" || q.status === "enviada") && !isExpired(q.valid_until);
  const lists: Record<View, { kind: "q" | "o"; at: string; q?: Q; o?: O }[]> = {
    cotizaciones: quotes.filter(isOpenQuote).map((q) => ({ kind: "q", at: q.created_at, q })),
    porentregar: orders.filter((o) => OPEN.includes(o.status)).map((o) => ({ kind: "o", at: o.created_at, o })),
    entregados: orders.filter((o) => o.status === "entregado").map((o) => ({ kind: "o", at: o.created_at, o })),
    cerrados: [
      ...orders.filter((o) => o.status === "cancelado").map((o) => ({ kind: "o" as const, at: o.created_at, o })),
      ...quotes.filter((q) => q.status !== "aceptada" && !isOpenQuote(q)).map((q) => ({ kind: "q" as const, at: q.created_at, q })),
    ].sort((a, b) => b.at.localeCompare(a.at)),
  };
  const rows = lists[view];
  const href = (extra: string) => `/admin/pedidos?v=${view}${extra}`;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl">Pedidos</h1>
        <div className="flex gap-2">
          <Link href={href("&nuevo=cotizar")} className="rounded-full bg-ink px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
            + Cotizar
          </Link>
          <Link href={href("&nuevo=pedido")} className="rounded-full border border-ink-muted px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-background">
            + Pedido directo
          </Link>
        </div>
      </div>

      {sp.ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Listo.</p>}
      {sp.error && (
        <p className="mt-3 font-mono text-xs text-alarm">
          {ERRORS[sp.error] ?? "Ocurrió un error."}
          {sp.error === "stock" && sp.detalle ? ` ${sp.detalle.replace(/^sin stock: /, "")}. Registra una entrada en Inventario.` : ""}
        </p>
      )}

      {nuevo && (
        <div className="mt-5">
          <p className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            <span>{nuevo === "cotizar" ? "Nueva cotización" : "Nuevo pedido directo"}</span>
            <Link href={href("")} className="hover:text-ink">Cerrar ✕</Link>
          </p>
          {nuevo === "cotizar"
            ? <FormCotizacion customers={(cus?.data ?? []) as Opt[]} zones={(zon?.data ?? []) as Opt[]} products={(prod?.data ?? []) as Prod[]} available={available} />
            : <FormPedido customers={(cus?.data ?? []) as Opt[]} zones={(zon?.data ?? []) as Opt[]} products={(prod?.data ?? []) as Prod[]} available={available} />}
        </div>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        {VIEWS.map((k) => (
          <Link key={k} href={`/admin/pedidos?v=${k}`}
            className={`rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] ${k === view ? "border-ink bg-ink text-background" : "border-rule text-ink-muted hover:text-ink"}`}>
            {VIEW_LABEL[k]} · {lists[k].length}
          </Link>
        ))}
      </nav>

      <ul className="mt-4 divide-y divide-rule">
        {rows.length === 0 && <li className="py-4 text-ink-muted">Nada por aquí.</li>}
        {rows.map((r) => {
          if (r.kind === "q" && r.q) {
            const q = r.q;
            const vencida = (q.status === "borrador" || q.status === "enviada") && isExpired(q.valid_until);
            return (
              <li key={`q-${q.id}`} className="py-4">
                <Link href={`/admin/pedidos/cotizaciones/${q.id}`} className="block hover:opacity-80">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg">{q.quote_number} · {q.customer_name ?? "Sin nombre"}</p>
                    <p className="font-mono text-lg">{colones(q.total_crc)}</p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    Cotización · {QUOTE_STATUS[q.status] ?? q.status}
                    {vencida && <span className="text-alarm"> · vencida</span>}
                    {" · "}{new Date(q.created_at).toLocaleDateString("es-CR")}
                  </p>
                </Link>
              </li>
            );
          }
          const o = r.o as O;
          const next = NEXT[o.status];
          const open = OPEN.includes(o.status);
          const bottles = o.order_items.reduce((a, i) => a + i.qty, 0);
          return (
            <li key={`o-${o.id}`} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-lg">#{o.id} · {o.customers?.name ?? "Sin cliente"}</p>
                <p className="font-mono text-lg">{colones(o.total_crc)}</p>
              </div>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                <span className={o.status === "nuevo" ? "text-alarm" : ""}>{STATUS[o.status] ?? o.status}</span>
                {" · "}{o.paid ? "Pagado" : "Sin pagar"}{" · "}{o.channel}{" · "}
                {new Date(o.created_at).toLocaleDateString("es-CR")}
                {fromQuote.has(o.id) && ` · desde ${fromQuote.get(o.id)}`}
                {open && ` · ${bottles} botella${bottles === 1 ? "" : "s"} reservada${bottles === 1 ? "" : "s"}`}
              </p>
              {open && cancelarId === o.id && (
                <div className="mt-3 border border-alarm p-3 text-sm">
                  <p>¿Cancelar el pedido #{o.id}? Se liberan {bottles} botella{bottles === 1 ? "" : "s"} al inventario disponible. No se puede deshacer.</p>
                  <div className="mt-2 flex items-center gap-4">
                    <form action={changeStatus}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="cancelado" />
                      <button className="rounded-full bg-alarm px-4 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-background">Sí, cancelar</button>
                    </form>
                    <Link href={href("")} className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink">No</Link>
                  </div>
                </div>
              )}
              {open && cancelarId !== o.id && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {next && (
                    <form action={changeStatus} className="flex items-center gap-3">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value={next.to} />
                      {next.to === "entregado" && (
                        <label className="flex items-center gap-2 text-xs text-ink-muted">
                          <input type="checkbox" name="age_ok" /> Verifiqué que es mayor de 18
                        </label>
                      )}
                      <button className="rounded-full border border-ink-muted px-4 py-1 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background">
                        {next.text}
                      </button>
                    </form>
                  )}
                  {!o.paid && (
                    <form action={markPaid}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <button className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink">Marcar pagado</button>
                    </form>
                  )}
                  <Link href={href(`&cancelar=${o.id}`)} className="font-mono text-[11px] uppercase tracking-[0.18em] text-alarm">Cancelar</Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
