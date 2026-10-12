// [LA14 · COMPETENCIA · v2] app/admin/competencia/components/BuscadorCompetencia.tsx
"use client";

import { useActionState } from "react";
import { buscarCompetencia } from "../actions";
import { colones } from "@/lib/forms";
import type { ResultRow, SearchResult, SourceStatus } from "@/lib/competencia/types";

const STATE_LABEL: Record<SourceStatus["state"], string> = {
  ok: "Consultada",
  sin_resultados: "Sin resultados",
  error: "Con error",
  bloqueado: "Bloqueada por la tienda",
  pendiente: "Por configurar",
};
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);
const sizeLabel = (r: ResultRow) =>
  (r.sizeMl ? `${r.sizeMl} ml` : "—") + (r.packCount > 1 ? ` × ${r.packCount}` : "");

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{title}</div>
      <div className="mt-1 font-mono text-2xl leading-none">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export function BuscadorCompetencia() {
  const [res, action, pending] = useActionState<SearchResult | null, FormData>(buscarCompetencia, null);
  const primary = res?.clusters.find((c) => c.key === res.primaryKey) ?? null;

  return (
    <section>
      <form action={action} className="flex flex-wrap items-end gap-3 border-y border-rule py-5">
        <div className="min-w-[14rem] flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Buscar un producto en las tiendas</p>
          <input
            name="q" required minLength={2} maxLength={80} autoComplete="off"
            placeholder="Fireball 750ml, Jack Daniels…"
            className="mt-1 w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted"
          />
        </div>
        <button
          disabled={pending}
          className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Consultando…" : "Buscar"}
        </button>
      </form>
      {pending && <p className="mt-3 font-mono text-xs text-ink-muted">Consultando las tiendas, puede tardar unos segundos…</p>}

      {res && !pending && (
        <div className="mt-5">
          {res.error && <p className="font-mono text-xs text-alarm">{res.error}</p>}

          {res.ok && (
            <>
              <p className="font-mono text-xs text-ink-faint">
                &quot;{res.query}&quot; · {res.rows.length} resultados · {(res.durationMs / 1000).toFixed(1)} s
              </p>

              {primary && (
                <>
                  <p className="mt-3 font-serif text-lg">{primary.label}</p>
                  <div className="mt-2 grid grid-cols-2 divide-x divide-rule border-y-2 border-ink-muted sm:grid-cols-5">
                    <Card title="Más bajo" value={primary.min ? colones(primary.min.price) : "—"} sub={primary.min?.source} />
                    <Card title="Más alto" value={primary.max ? colones(primary.max.price) : "—"} sub={primary.max?.source} />
                    <Card title="Diferencia" value={primary.spread !== null ? colones(primary.spread) : "—"} sub={primary.spreadPct !== null ? `${primary.spreadPct}% sobre el más bajo` : undefined} />
                    <Card title="No disponibles" value={String(res.unavailableCount)} />
                    <Card title="Otras presentaciones" value={String(res.otherPresentationCount)} />
                  </div>
                </>
              )}

              {res.rows.length === 0 ? (
                <p className="mt-4 text-ink-muted">Ninguna tienda devolvió productos para esa búsqueda. Mira el estado de las fuentes abajo.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                      <tr className="border-b border-rule">
                        <th className="py-2 font-normal">Competidor</th>
                        <th className="font-normal">Producto</th>
                        <th className="font-normal">Presentación</th>
                        <th className="text-right font-normal">Precio</th>
                        <th className="pl-4 font-normal">Disponibilidad</th>
                        <th className="font-normal">Promoción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.rows.map((r, i) => {
                        const isMin = r.isPrimary && primary?.min && r.price === primary.min.price && r.inStock !== false;
                        const href = safeHref(r.url);
                        return (
                          <tr key={i} className={`border-b border-rule ${r.isPrimary ? "" : "opacity-60"}`}>
                            <td className="py-3">{r.sourceName}</td>
                            <td>
                              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.name}</a> : r.name}
                              {!r.isPrimary && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-ink-faint">otra presentación</span>}
                            </td>
                            <td className="font-mono text-xs">{sizeLabel(r)}</td>
                            <td className={`text-right font-mono ${isMin ? "text-ink" : "text-ink-muted"}`}>
                              {r.price ? colones(r.price) : "—"}{isMin && <span className="ml-2 text-[10px] uppercase tracking-[0.14em]">más bajo</span>}
                            </td>
                            <td className={`pl-4 text-xs ${r.inStock === false ? "text-alarm" : "text-ink-muted"}`}>
                              {r.inStock === true ? "Disponible" : r.inStock === false ? "Agotado" : "—"}
                            </td>
                            <td className="font-mono text-xs">
                              {r.promoPct ? `−${r.promoPct}%${r.comparePrice ? ` (antes ${colones(r.comparePrice)})` : ""}` : r.promoText ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-xs text-ink-faint">
                {res.saved ? "✓ Búsqueda guardada en el historial." : res.saveNote ?? ""}
              </p>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-ink-muted hover:text-ink">Estado de las fuentes</summary>
                <ul className="mt-2 divide-y divide-rule border-y border-rule">
                  {res.statuses.map((s) => (
                    <li key={s.slug} className="grid grid-cols-[1fr_auto] gap-3 py-2">
                      <p>{s.name} <span className="text-xs text-ink-faint">{s.message ?? ""}</span></p>
                      <p className={`font-mono text-xs ${s.state === "ok" || s.state === "sin_resultados" ? "text-ink-muted" : "text-alarm"}`}>
                        {STATE_LABEL[s.state]} · {s.count} · {(s.ms / 1000).toFixed(1)} s
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
