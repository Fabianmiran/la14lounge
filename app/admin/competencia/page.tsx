// [LA14 · COMPETENCIA · v1] app/admin/competencia/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { searchCompetencia } from "./actions";
import { searchCompetitors } from "@/lib/competencia/search";
import type { CompetitorResult } from "@/lib/competencia/types";

const input =
  "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";

export default async function Competencia({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { q, error } = await searchParams;
  const query = q?.trim() ?? "";

  const supabase = await createClient();
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name, channel")
    .order("id");

  let search: {
    results: CompetitorResult[];
    errors: { competitor: string; error: string }[];
    lowest: CompetitorResult | null;
  } | null = null;
  if (query) {
    try {
      search = await searchCompetitors(query);
    } catch {
      search = { results: [], errors: [{ competitor: "Competencia", error: "No se pudo ejecutar la búsqueda." }], lowest: null };
    }
  }

  const results = search?.results ?? [];

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">Competencia</h1>
        <div className="flex items-center gap-4"><Link href="/admin/competencia/monitor" className="text-sm text-ink-muted hover:text-ink">Monitor semanal →</Link><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Búsqueda manual</span></div>
      </div>

      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Consulta precios públicos de los competidores registrados. La búsqueda no realiza compras, inicia sesión ni modifica carritos.
      </p>

      {error === "consulta" && <p className="mt-3 font-mono text-xs text-alarm">Escribe un producto para buscar.</p>}
      {error === "guardar" && <p className="mt-3 font-mono text-xs text-alarm">No se pudo registrar la búsqueda.</p>}

      <form action={searchCompetencia} className="mt-6 flex gap-2 border-y border-rule py-6">
        <div className="flex-1">
          <p className={label}>Producto o presentación</p>
          <input
            name="query"
            defaultValue={query}
            required
            maxLength={120}
            placeholder="Ej. Fireball 750ml"
            className={input}
          />
        </div>
        <button className="mt-[18px] rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
          Buscar
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-faint">
        {(competitors ?? []).map((c) => <span key={c.id}>{c.name}</span>)}
      </div>

      {query && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">Resultados</h2>
              <p className="mt-1 text-xs text-ink-faint">Búsqueda: {query}</p>
            </div>
            {search?.lowest && (
              <div className="text-right">
                <p className={label}>Precio más bajo</p>
                <p className="font-mono text-xl">{colones(search.lowest.price ?? 0)}</p>
                <p className="text-xs text-ink-muted">{search.lowest.competitorName}</p>
              </div>
            )}
          </div>

          {results.length === 0 ? (
            <p className="mt-6 border-y border-rule py-6 text-sm text-ink-muted">
              No se encontraron resultados en las fuentes actualmente disponibles.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <tr className="border-b border-rule">
                    <th className="py-2 font-normal">Competidor</th>
                    <th className="font-normal">Producto</th>
                    <th className="font-normal">Presentación</th>
                    <th className="text-right font-normal">Precio</th>
                    <th className="text-right font-normal">Promoción</th>
                    <th className="text-right font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {results.map((r, index) => (
                    <tr key={`${r.competitorId}-${r.productName}-${index}`} className="border-b border-rule">
                      <td className="py-3 font-sans">{r.competitorName}</td>
                      <td className="font-sans">{r.productName}</td>
                      <td>{r.presentation ?? "—"}</td>
                      <td className="text-right">{r.price !== null ? colones(r.price) : "—"}</td>
                      <td className="text-right">{r.discountPercent ? `-${r.discountPercent}%` : r.promotion ? "Sí" : "—"}</td>
                      <td className="text-right">{r.available === false ? "Agotado" : "Disponible"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {search?.errors.length ? (
            <div className="mt-6 border-t border-rule pt-4">
              <p className={label}>Fuentes con incidencia</p>
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                {search.errors.map((e) => <li key={e.competitor}>· {e.competitor}: {e.error}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <section className="mt-10 bg-surface p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div><h2 className="font-serif text-2xl">Monitor semanal</h2><p className="mt-1 text-sm text-ink-muted">Histórico y ejecuciones automáticas de las fuentes registradas.</p></div>
          <Link href="/admin/competencia/monitor" className="text-sm text-ink-muted hover:text-ink">Abrir monitor →</Link>
        </div>
      </section>
    </>
  );
}
