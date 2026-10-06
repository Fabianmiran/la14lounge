// [LA14 · PROVEEDORES · v1] app/admin/proveedores/precios/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { addPrice } from "./actions";

const input =
  "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";

type Row = {
  id: number;
  name: string;
  size_ml: number;
  landed_cost_crc: number | null;
  sale_price: number | null;
  cheapest_competitor_crc: number | null;
  margin_pct: number | null;
};

export default async function Precios({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const [sup, prod, over, best] = await Promise.all([
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("products").select("id, name, size_ml").order("name"),
    supabase.from("v_pricing_overview").select("*").order("name"),
    supabase.from("v_best_supplier").select("product_id, supplier_id"),
  ]);

  const suppliers = (sup.data ?? []) as { id: number; name: string }[];
  const products = (prod.data ?? []) as { id: number; name: string; size_ml: number }[];
  const rows = (over.data ?? []) as Row[];
  const supName = new Map(suppliers.map((s) => [s.id, s.name]));
  const bestOf = new Map(
    ((best.data ?? []) as { product_id: number; supplier_id: number }[]).map((b) => [
      b.product_id,
      supName.get(b.supplier_id) ?? "—",
    ])
  );

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Precios y comparador</h1>
        <Link href="/admin/proveedores" className="text-sm text-ink-muted hover:text-ink">← Proveedores</Link>
      </div>

      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Precio guardado.</p>}
      {error && (
        <p className="mt-3 font-mono text-xs text-alarm">
          {error === "datos"
            ? "Revisa los datos: elige proveedor y producto, y pon un costo mayor a cero."
            : "No se pudo guardar. Intenta de nuevo."}
        </p>
      )}

      {suppliers.length === 0 ? (
        <p className="mt-6 text-ink-muted">
          Primero agrega al menos un proveedor en la pestaña Proveedores.
        </p>
      ) : (
        <form action={addPrice} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
          <div>
            <p className={label}>Proveedor *</p>
            <select name="supplier_id" required className={input} defaultValue="">
              <option value="" disabled>Elegir…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <p className={label}>Producto *</p>
            <select name="product_id" required className={input} defaultValue="">
              <option value="" disabled>Elegir…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.size_ml} ml</option>)}
            </select>
          </div>
          <div>
            <p className={label}>Costo por unidad (₡) *</p>
            <input name="cost_crc" required inputMode="numeric" className={input} />
          </div>
          <div>
            <p className={label}>Cantidad mínima</p>
            <input name="min_qty" inputMode="numeric" defaultValue="1" className={input} />
          </div>
          <div>
            <p className={label}>Flete por unidad (₡)</p>
            <input name="freight_crc" inputMode="numeric" defaultValue="0" className={input} />
          </div>
          <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit">
            Guardar precio
          </button>
        </form>
      )}

      <h2 className="mt-10 font-serif text-2xl">Comparador</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Costo = precio del proveedor + flete. Margen = (precio de venta − costo) ÷ precio de venta.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            <tr className="border-b border-rule">
              <th className="py-2 font-normal">Producto</th>
              <th className="font-normal">Mejor proveedor</th>
              <th className="text-right font-normal">Costo</th>
              <th className="text-right font-normal">Precio venta</th>
              <th className="text-right font-normal">Competencia</th>
              <th className="text-right font-normal">Margen</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-rule">
                <td className="py-3 font-sans">{r.name} <span className="text-ink-faint">{r.size_ml} ml</span></td>
                <td className="font-sans text-ink-muted">{bestOf.get(r.id) ?? "—"}</td>
                <td className="text-right">{r.landed_cost_crc ? colones(r.landed_cost_crc) : "—"}</td>
                <td className="text-right">{r.sale_price ? colones(r.sale_price) : "—"}</td>
                <td className="text-right">{r.cheapest_competitor_crc ? colones(r.cheapest_competitor_crc) : "—"}</td>
                <td className={`text-right ${r.margin_pct !== null && r.margin_pct < 10 ? "text-alarm" : ""}`}>
                  {r.margin_pct !== null ? `${r.margin_pct}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
