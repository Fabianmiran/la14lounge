// [LA14 · COTIZADOR · v1] app/admin/pedidos/cotizaciones/[id]/page.tsx
// Vista INTERNA: muestra costos y margen. Nunca se la muestres al cliente (para eso está /cliente).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { QUOTE_STATUS, UUID_RE, fechaCR, isExpired } from "@/lib/cotizador";
import { acceptQuote, setQuoteStatus } from "../actions";

const ERRORS: Record<string, string> = {
  vencida: "La cotización está vencida. Crea una nueva con precios actualizados.",
  cerrada: "La cotización ya está cerrada (aceptada o rechazada).",
};

type Q = {
  id: string; quote_number: string; customer_name: string | null; zone_name: string | null; delivery_fee: number;
  subtotal_crc: number; total_crc: number; valid_until: string; notes: string | null; status: string;
  order_id: number | null; min_margin_pct: number;
};
type I = {
  id: string; name: string; size_ml: number | null; qty: number; list_price_crc: number; discount_pct: number;
  unit_price_crc: number; unit_cost_crc: number | null; below_min_margin: boolean;
};

export default async function Cotizacion({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [qr, ir] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("name"),
  ]);
  const q = qr.data as Q | null;
  if (!q) notFound();
  const items = (ir.data ?? []) as I[];

  const open = q.status === "borrador" || q.status === "enviada";
  const vencida = open && isExpired(q.valid_until);
  const cost = items.reduce((a, i) => a + (i.unit_cost_crc ?? 0) * i.qty, 0);
  const missingCost = items.some((i) => i.unit_cost_crc === null);
  const margin = !missingCost && q.subtotal_crc > 0 ? ((q.subtotal_crc - cost) * 100) / q.subtotal_crc : null;
  const alerts = items.filter((i) => i.below_min_margin).length;

  return (
    <>
      <p className="font-mono text-xs text-ink-muted">
        <Link href="/admin/pedidos/cotizaciones" className="hover:text-ink">← Cotizaciones</Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl">{q.quote_number} · {q.customer_name ?? "Sin nombre"}</h1>
      <p className="mt-1 font-mono text-xs text-ink-muted">
        {QUOTE_STATUS[q.status] ?? q.status}
        {vencida && <span className="text-alarm"> · vencida</span>}
        {" · válida hasta "}{fechaCR(q.valid_until)}
        {q.zone_name ? ` · envío a ${q.zone_name}` : ""}
      </p>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Listo.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}

      <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-ink-faint">Vista interna (con costos)</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            <tr>
              <th className="py-2 pr-3">Producto</th><th className="pr-3">Cant.</th><th className="pr-3">Lista</th>
              <th className="pr-3">Desc.</th><th className="pr-3">Precio</th><th className="pr-3">Costo</th><th>Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule font-mono text-xs">
            {items.map((i) => {
              const m = i.unit_cost_crc !== null && i.unit_price_crc > 0 ? ((i.unit_price_crc - i.unit_cost_crc) * 100) / i.unit_price_crc : null;
              return (
                <tr key={i.id}>
                  <td className="py-2 pr-3 font-sans text-sm">{i.name}{i.size_ml ? ` · ${i.size_ml} ml` : ""}</td>
                  <td className="pr-3">{i.qty}</td>
                  <td className="pr-3">{colones(i.list_price_crc)}</td>
                  <td className="pr-3">{Number(i.discount_pct) > 0 ? `${Number(i.discount_pct)}%` : "—"}</td>
                  <td className="pr-3">{colones(i.unit_price_crc)}</td>
                  <td className="pr-3">{i.unit_cost_crc === null ? "sin costo" : colones(i.unit_cost_crc)}</td>
                  <td className={i.below_min_margin ? "text-alarm" : ""}>
                    {m === null ? "—" : `${m.toFixed(1)}%`}{i.below_min_margin ? " ⚠" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 border-t border-rule pt-4 font-mono text-sm">
        <p>Subtotal: {colones(q.subtotal_crc)}</p>
        <p>Envío: {q.delivery_fee === 0 ? (q.zone_name ? "gratis" : "—") : colones(q.delivery_fee)}</p>
        <p className="text-lg">Total al cliente: {colones(q.total_crc)}</p>
        <p className="text-xs text-ink-muted">
          Margen sobre productos: {margin === null ? "no se puede calcular (faltan costos de proveedor)" : `${margin.toFixed(1)}%`}
          {" · "}mínimo {Number(q.min_margin_pct)}%
        </p>
        {alerts > 0 && (
          <p className="text-xs text-alarm">
            ⚠ {alerts} línea{alerts > 1 ? "s" : ""} bajo el margen mínimo. Revisa el descuento antes de enviar.
          </p>
        )}
      </div>
      {q.notes && <p className="mt-3 text-sm text-ink-muted">Notas: {q.notes}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <Link
          href={`/admin/pedidos/cotizaciones/${q.id}/cliente`}
          className="rounded-full bg-ink px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90"
        >
          Vista del cliente (WhatsApp / PDF)
        </Link>
        {q.status === "borrador" && (
          <form action={setQuoteStatus}>
            <input type="hidden" name="quote_id" value={q.id} />
            <input type="hidden" name="status" value="enviada" />
            <button className="rounded-full border border-ink-muted px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background">
              Marcar como enviada
            </button>
          </form>
        )}
        {open && !vencida && (
          <form action={acceptQuote} className="flex items-center gap-2">
            <input type="hidden" name="quote_id" value={q.id} />
            <select name="payment_method" defaultValue="sinpe" className="border border-rule bg-background p-2 text-xs">
              <option value="sinpe">SINPE</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
            </select>
            <button className="rounded-full border border-ink-muted px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background">
              Cliente aceptó → crear pedido
            </button>
          </form>
        )}
        {open && (
          <form action={setQuoteStatus}>
            <input type="hidden" name="quote_id" value={q.id} />
            <input type="hidden" name="status" value="rechazada" />
            <button className="font-mono text-[11px] uppercase tracking-[0.18em] text-alarm">Rechazada</button>
          </form>
        )}
        {q.status === "aceptada" && q.order_id && (
          <Link href="/admin/pedidos" className="font-mono text-xs text-ink-muted hover:text-ink">
            Se creó el pedido #{q.order_id} →
          </Link>
        )}
      </div>
    </>
  );
}
