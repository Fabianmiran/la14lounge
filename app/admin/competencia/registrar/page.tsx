// [LA14 · COMPETENCIA · v2] app/admin/competencia/registrar/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { saveCompetitorPrices } from "../actions";

const ERRORS: Record<string, string> = {
  precio: "Hay un precio mal escrito. Usa solo números enteros, sin decimales ni letras.",
  vacio: "No escribiste ningún precio.",
  guardar: "No se pudo guardar. Intenta de nuevo.",
};

export default async function Registrar({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; ok?: string; error?: string }>;
}) {
  const { c, ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: comps } = await supabase.from("competitors").select("id, name").order("name");
  const competitors = (comps ?? []) as { id: number; name: string }[];
  const current = competitors.find((x) => String(x.id) === c);

  if (!current) {
    return (
      <>
        <h1 className="font-serif text-3xl">Actualizar precios</h1>
        <p className="mt-3 text-ink-muted">Elige el competidor:</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {competitors.map((x) => (
            <li key={x.id} className="py-3">
              <Link href={`/admin/competencia/registrar?c=${x.id}`} className="font-serif text-lg hover:underline">{x.name}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-4"><Link href="/admin/competencia" className="text-sm text-ink-muted hover:text-ink">← Competencia</Link></p>
      </>
    );
  }

  const [pRes, lRes] = await Promise.all([
    supabase.from("products").select("id, name, size_ml, sale_price").eq("active", true).order("name"),
    supabase.from("v_latest_competitor_price").select("product_id, price_crc").eq("competitor_id", current.id),
  ]);
  const products = (pRes.data ?? []) as { id: number; name: string; size_ml: number; sale_price: number | null }[];
  const last = new Map(((lRes.data ?? []) as { product_id: number; price_crc: number }[]).map((l) => [l.product_id, l.price_crc]));

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Precios de {current.name}</h1>
        <Link href="/admin/competencia" className="text-sm text-ink-muted hover:text-ink">← Competencia</Link>
      </div>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ {ok === "0" ? "No hubo cambios que guardar." : `${ok} precios guardados.`}</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}
      <p className="mt-2 text-xs text-ink-faint">
        Escribe el precio que ves en su tienda. Deja en blanco los productos que no vende. Solo se guardan los que cambiaron.
      </p>

      <form action={saveCompetitorPrices} className="mt-4">
        <input type="hidden" name="competitor_id" value={current.id} />
        <ul className="divide-y divide-rule border-y border-rule">
          {products.length === 0 && <li className="py-4 text-ink-muted">No hay productos activos.</li>}
          {products.map((p) => (
            <li key={p.id} className="grid grid-cols-[1fr_auto_8rem] items-center gap-4 py-2">
              <p className="text-sm">{p.name} <span className="text-xs text-ink-faint">{p.size_ml} ml</span></p>
              <p className="font-mono text-xs text-ink-faint">tú: {p.sale_price ? colones(p.sale_price) : "—"}</p>
              <input
                name={`price_${p.id}`}
                inputMode="numeric"
                maxLength={12}
                placeholder={last.has(p.id) ? colones(last.get(p.id)!) : "₡"}
                className="w-full border border-rule bg-background p-1.5 text-right font-mono text-sm outline-none focus:border-ink-muted"
              />
            </li>
          ))}
        </ul>
        <button className="mt-4 rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
          Guardar precios
        </button>
      </form>
    </>
  );
}
