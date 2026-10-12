// [LA14 · COMPETENCIA · v2] app/admin/competencia/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { createCompetitor } from "./actions";
import { BuscadorCompetencia } from "./components/BuscadorCompetencia";

// La búsqueda consulta varias tiendas a la vez; se da hasta 30 s.
export const maxDuration = 30;

const TOL = 3; // % de diferencia que se considera "parejo"
const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const ERRORS: Record<string, string> = {
  nombre: "El nombre es obligatorio.",
  url: "El enlace no es válido. Debe empezar con https://",
  guardar: "No se pudo guardar. Intenta de nuevo.",
};

type Comp = { id: number; name: string; channel: string | null; url: string | null };
type Prod = { id: number; name: string; size_ml: number; sale_price: number | null };
type LP = { product_id: number; competitor_id: number; price_crc: number; captured_at: string };

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default async function Competencia({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const [cRes, pRes, lRes] = await Promise.all([
    supabase.from("competitors").select("id, name, channel, url").order("name"),
    supabase.from("products").select("id, name, size_ml, sale_price").eq("active", true).order("name"),
    supabase.from("v_latest_competitor_price").select("product_id, competitor_id, price_crc, captured_at"),
  ]);
  const competitors = (cRes.data ?? []) as Comp[];
  const products = (pRes.data ?? []) as Prod[];
  const latest = (lRes.data ?? []) as LP[];
  const compName = new Map(competitors.map((c) => [c.id, c.name]));

  const rows = products
    .map((p) => {
      const prices = latest.filter((l) => l.product_id === p.id);
      const best = prices.sort((a, b) => a.price_crc - b.price_crc)[0];
      const diff =
        best && p.sale_price ? Math.round(((p.sale_price - best.price_crc) / best.price_crc) * 1000) / 10 : null;
      return { p, best, diff };
    })
    .sort((a, b) => (b.diff ?? -999) - (a.diff ?? -999));

  return (
    <>
      <h1 className="font-serif text-3xl">Competencia</h1>

      <div className="mt-6"><BuscadorCompetencia /></div>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Competidor guardado.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}

      <h2 className="mt-10 font-serif text-2xl">Comparador con tus precios</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Tu precio contra el más barato que has registrado. Rojo: estás más de {TOL}% por encima.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            <tr className="border-b border-rule">
              <th className="py-2 font-normal">Producto</th>
              <th className="text-right font-normal">Tu precio</th>
              <th className="text-right font-normal">Más barato</th>
              <th className="pl-4 font-normal">Dónde</th>
              <th className="text-right font-normal">Diferencia</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(({ p, best, diff }) => (
              <tr key={p.id} className="border-b border-rule">
                <td className="py-3 font-sans">{p.name} <span className="text-ink-faint">{p.size_ml} ml</span></td>
                <td className="text-right">{p.sale_price ? colones(p.sale_price) : "—"}</td>
                <td className="text-right">{best ? colones(best.price_crc) : "—"}</td>
                <td className="pl-4 font-sans text-xs text-ink-muted">
                  {best ? compName.get(best.competitor_id) ?? "—" : "—"}
                  {best && <span className="text-ink-faint"> · hace {daysAgo(best.captured_at)} d{daysAgo(best.captured_at) > 30 ? " (revisar)" : ""}</span>}
                </td>
                <td className={`text-right ${diff !== null && diff > TOL ? "text-alarm" : ""}`}>
                  {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-faint">Un guion (—) significa que falta el dato, no que sea cero.</p>

      <h2 className="mt-10 font-serif text-2xl">Competidores</h2>
      <form action={createCompetitor} className="mt-3 grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
        <div>
          <p className={label}>Nombre *</p>
          <input name="name" required maxLength={80} placeholder="Walmart, PriceSmart…" className={input} />
        </div>
        <div>
          <p className={label}>Tipo</p>
          <select name="channel" className={input} defaultValue="web">
            <option value="web">Tienda en línea</option>
            <option value="fisica">Tienda física</option>
          </select>
        </div>
        <div>
          <p className={label}>Enlace (opcional)</p>
          <input name="url" maxLength={300} placeholder="https://" className={input} />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit">
          Agregar competidor
        </button>
      </form>

      <ul className="mt-4 divide-y divide-rule">
        {competitors.length === 0 && <li className="py-4 text-ink-muted">Aún no hay competidores. Agrega el primero arriba.</li>}
        {competitors.map((c) => {
          const mine = latest.filter((l) => l.competitor_id === c.id);
          const newest = mine.map((l) => l.captured_at).sort().at(-1);
          const link = safeUrl(c.url);
          return (
            <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
              <div>
                <p className="font-serif text-lg">
                  {c.name} <span className="font-sans text-xs text-ink-faint">{c.channel === "web" ? "en línea" : "física"}</span>
                </p>
                <p className="font-mono text-xs text-ink-muted">
                  {mine.length} productos con precio{newest ? ` · actualizado hace ${daysAgo(newest)} d` : ""}
                  {link && <> · <a href={link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">abrir sitio</a></>}
                </p>
              </div>
              <Link href={`/admin/competencia/registrar?c=${c.id}`} className="rounded-full border border-ink-muted px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background">
                Actualizar precios
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
