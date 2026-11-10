// [LA14 · COTIZADOR · v1] app/admin/pedidos/cotizaciones/[id]/cliente/page.tsx
// Vista para el CLIENTE: sin costos, sin márgenes, sin proveedores.
// Por eso aquí se piden solo las columnas necesarias (nunca unit_cost_crc).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import PrintButton from "@/components/PrintButton";
import { UUID_RE, fechaCR, waNumber, whatsappText, type ClientLine, type ClientQuote } from "@/lib/cotizador";

const OLIVE = "#4a5a2a", GOLD = "#b8924a", INK = "#161412", CREAM = "#f6f0e1";

export default async function VistaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [qr, ir] = await Promise.all([
    supabase.from("quotes")
      .select("quote_number, customer_id, customer_name, zone_name, delivery_fee, subtotal_crc, total_crc, valid_until, notes, created_at")
      .eq("id", id).maybeSingle(),
    supabase.from("quote_items")
      .select("name, size_ml, qty, unit_price_crc, list_price_crc, discount_pct").eq("quote_id", id).order("name"),
  ]);
  const q = qr.data as (ClientQuote & { customer_id: number | null; created_at: string }) | null;
  if (!q) notFound();
  const lines = (ir.data ?? []) as ClientLine[];

  let phone = "";
  if (q.customer_id) {
    const { data } = await supabase.from("customers").select("whatsapp, phone").eq("id", q.customer_id).maybeSingle();
    phone = waNumber(data?.whatsapp) || waNumber(data?.phone);
  }
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText(q, lines))}`;

  return (
    <>
      <div className="print:hidden">
        <p className="font-mono text-xs text-ink-muted">
          <Link href={`/admin/pedidos/cotizaciones/${id}`} className="hover:text-ink">← Vista interna</Link>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={wa} target="_blank" rel="noopener noreferrer"
             className="rounded-full bg-ink px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
            Enviar por WhatsApp
          </a>
          <PrintButton />
          <p className="text-xs text-ink-muted">
            {phone ? "Se abre el chat del cliente con el mensaje listo." : "El cliente no tiene WhatsApp registrado: eliges el contacto al abrir."}
          </p>
        </div>
      </div>

      <article className="mx-auto mt-6 max-w-2xl p-8 print:mt-0 print:p-0" style={{ background: CREAM, color: INK }}>
        <header className="flex items-end justify-between border-b-2 pb-4" style={{ borderColor: GOLD }}>
          <div>
            <p className="font-serif text-4xl" style={{ color: OLIVE }}>La 14 Lounge</p>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Licores · entrega en el GAM</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl">Cotización</p>
            <p className="font-mono text-sm">{q.quote_number}</p>
          </div>
        </header>

        <p className="mt-4 text-sm">
          {q.customer_name && <>Para: <strong>{q.customer_name}</strong><br /></>}
          Fecha: {fechaCR(q.created_at)} · Válida hasta: <strong>{fechaCR(q.valid_until)}</strong>
        </p>

        <table className="mt-5 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-[0.12em]" style={{ borderColor: INK }}>
              <th className="py-2">Producto</th><th>Cant.</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b" style={{ borderColor: "rgba(22,20,18,.15)" }}>
                <td className="py-2">
                  {l.name}{l.size_ml ? ` · ${l.size_ml} ml` : ""}
                  {Number(l.discount_pct) > 0 && (
                    <span className="block text-xs" style={{ color: OLIVE }}>
                      {Number(l.discount_pct)}% de descuento (antes {colones(l.list_price_crc)})
                    </span>
                  )}
                </td>
                <td>{l.qty}</td>
                <td className="text-right font-mono">{colones(l.unit_price_crc)}</td>
                <td className="text-right font-mono">{colones(l.unit_price_crc * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1 font-mono text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>{colones(q.subtotal_crc)}</span></p>
          {q.zone_name && (
            <p className="flex justify-between"><span>Envío ({q.zone_name})</span><span>{q.delivery_fee === 0 ? "Gratis" : colones(q.delivery_fee)}</span></p>
          )}
          <p className="flex justify-between border-t-2 pt-2 text-lg font-bold" style={{ borderColor: GOLD, color: OLIVE }}>
            <span>Total</span><span>{colones(q.total_crc)}</span>
          </p>
          <p className="text-right text-[11px]">IVA incluido</p>
        </div>

        {q.notes && <p className="mt-5 text-sm">{q.notes}</p>}
        <p className="mt-8 border-t pt-3 text-[11px]" style={{ borderColor: "rgba(22,20,18,.15)" }}>
          Precios sujetos a disponibilidad hasta la fecha de vigencia. Venta solo a personas mayores de 18 años;
          se verifica la edad al entregar. El consumo excesivo de alcohol es perjudicial para la salud.
        </p>
      </article>
    </>
  );
}
