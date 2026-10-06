// [LA14 · ENTREGAS · v1] components/SiteHeader.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "./CartProvider";

const colones = (n: number) => "₡" + n.toLocaleString("es-CR");
// Número de WhatsApp del negocio, solo dígitos con código de país (506...).
const WA = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");

type Zone = { id: number; name: string; fee_crc: number; free_over_crc: number | null };

export function SiteHeader() {
  const { items, count, subtotal, open, setOpen, setQty, clear } = useCart();
  const [adult, setAdult] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");

  // Las zonas de entrega son públicas (nombre y costo); se cargan al abrir el carrito.
  useEffect(() => {
    if (!open || zones.length > 0) return;
    supabase
      .from("delivery_zones")
      .select("id, name, fee_crc, free_over_crc")
      .order("name")
      .then(({ data }) => setZones((data ?? []) as Zone[]));
  }, [open, zones.length]);

  const zone = zones.find((z) => String(z.id) === zoneId);
  const fee = zone ? (zone.free_over_crc && subtotal >= zone.free_over_crc ? 0 : zone.fee_crc) : 0;
  const total = subtotal + fee;
  const ready = adult && !!zone && address.trim().length >= 5;

  const text = [
    "Hola, quiero hacer este pedido en La 14 Lounge:",
    ...items.map((i) => `• ${i.qty} x ${i.name} (${colones(i.price * i.qty)})`),
    `Subtotal: ${colones(subtotal)}`,
    `Zona: ${zone?.name ?? "-"} | Envío: ${colones(fee)}`,
    `Total aprox.: ${colones(total)}`,
    `Dirección: ${address.trim().slice(0, 200)}`,
    "Confirmo que soy mayor de 18 años.",
  ].join("\n");
  const href = WA ? `https://wa.me/${WA}?text=${encodeURIComponent(text)}` : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-background/90 backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <nav className="flex gap-6 text-sm text-ink-muted">
          <Link href="/catalogo" className="hover:text-ink">Catálogo</Link>
        </nav>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl">La 14 Lounge</Link>
        <button onClick={() => setOpen(true)} className="font-mono text-xs uppercase tracking-[0.18em]" aria-label={`Abrir carrito, ${count} productos`}>
          Carrito{count > 0 && <span className="ml-2 text-alarm">{count}</span>}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrito">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-rule bg-surface p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">Tu pedido</h2>
              <button onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:text-ink">Cerrar</button>
            </div>

            <ul className="mt-4 divide-y divide-rule">
              {items.length === 0 && <li className="py-6 text-ink-muted">Aún no agregas productos.</li>}
              {items.map((i) => (
                <li key={i.id} className="py-3">
                  <p className="text-sm">{i.name}</p>
                  <div className="mt-2 flex items-center justify-between font-mono text-sm">
                    <span className="flex items-center gap-3">
                      <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="Quitar uno">−</button>
                      {i.qty}
                      <button onClick={() => setQty(i.id, i.qty + 1)} aria-label="Agregar uno">+</button>
                    </span>
                    <span>{colones(i.price * i.qty)}</span>
                  </div>
                </li>
              ))}
            </ul>

            {items.length > 0 && (
              <div className="mt-auto border-t-2 border-ink-muted pt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Entrega</p>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="mt-1 w-full border border-rule bg-background p-2 text-sm"
                >
                  <option value="">Elige tu zona…</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value.slice(0, 200))}
                  placeholder="Dirección o señas"
                  className="mt-2 w-full border border-rule bg-background p-2 text-sm"
                />
                {zone?.free_over_crc ? (
                  <p className="mt-1 text-[11px] text-ink-faint">Envío gratis desde {colones(zone.free_over_crc)}.</p>
                ) : null}

                <div className="mt-4 space-y-1 font-mono text-sm">
                  <p className="flex justify-between text-ink-muted"><span>Subtotal</span><span>{colones(subtotal)}</span></p>
                  <p className="flex justify-between text-ink-muted"><span>Envío</span><span>{zone ? (fee === 0 ? "Gratis" : colones(fee)) : "—"}</span></p>
                  <p className="flex justify-between text-lg"><span>Total</span><span>{colones(total)}</span></p>
                </div>

                <label className="mt-3 flex items-start gap-2 text-xs text-ink-muted">
                  <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5" />
                  Confirmo que soy mayor de 18 años y que presentaré mi identificación en la entrega.
                </label>
                <a
                  href={ready ? href : undefined}
                  target="_blank" rel="noopener noreferrer"
                  aria-disabled={!ready || !href}
                  className={`mt-4 block rounded-full p-2 text-center font-mono text-xs uppercase tracking-[0.2em] ${ready && href ? "bg-ink text-background" : "cursor-not-allowed bg-rule text-ink-faint"}`}
                >
                  Pedir por WhatsApp
                </a>
                {!ready && <p className="mt-2 text-xs text-ink-faint">Elige tu zona, escribe tu dirección y confirma tu edad.</p>}
                {!href && <p className="mt-2 text-xs text-alarm">Falta configurar el número de WhatsApp.</p>}
                <button onClick={clear} className="mt-3 w-full text-xs text-ink-faint hover:text-ink">Vaciar carrito</button>
                <p className="mt-2 text-[11px] text-ink-faint">Precios sujetos a confirmación al momento del pedido.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}
