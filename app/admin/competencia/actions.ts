// [LA14 · COMPETENCIA · v2.1 · PERSISTENCIA v1] app/admin/competencia/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";
import { analyze } from "@/lib/competencia/compare";
import { cleanQuery, norm } from "@/lib/competencia/normalize";
import { searchAllSources } from "@/lib/competencia/search";
import type { SearchResult, SourceStatus } from "@/lib/competencia/types";

export async function createCompetitor(formData: FormData) {
  const supabase = await requireAdmin();

  const name = txt(formData, "name", 80);
  if (!name) redirect("/admin/competencia?error=nombre");

  const channel = txt(formData, "channel", 10) === "web" ? "web" : "fisica";

  // Solo se aceptan enlaces http/https válidos.
  let url = txt(formData, "url", 300);
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      url = u.toString();
    } catch {
      redirect("/admin/competencia?error=url");
    }
  }

  const { error } = await supabase.from("competitors").insert({ name, channel, url });
  if (error) redirect("/admin/competencia?error=guardar");

  revalidatePath("/admin/competencia");
  redirect("/admin/competencia?ok=1");
}

// Acepta 12990, 12 990, 12.990 o 12,990. Cualquier otra cosa se rechaza.
function parseCrc(raw: string): number | null {
  const s = raw.replace(/[₡\s]/g, "");
  if (!s) return null;
  if (!/^(\d{1,3}([.,]\d{3})+|\d+)$/.test(s)) return NaN;
  const n = Number(s.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) && n > 0 && n <= 10_000_000 ? n : NaN;
}

export async function saveCompetitorPrices(formData: FormData) {
  const supabase = await requireAdmin();

  const competitor = int(formData, "competitor_id");
  if (!competitor) redirect("/admin/competencia?error=guardar");
  const back = `/admin/competencia/registrar?c=${competitor}`;

  const entries: { product_id: number; price_crc: number }[] = [];
  let count = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_") || typeof value !== "string") continue;
    if (++count > 400) break;
    const product_id = Number(key.slice(6));
    if (!Number.isSafeInteger(product_id) || product_id < 1) continue;
    const price = parseCrc(value);
    if (price === null) continue;
    if (Number.isNaN(price)) redirect(`${back}&error=precio`);
    entries.push({ product_id, price_crc: price });
  }
  if (entries.length === 0) redirect(`${back}&error=vacio`);

  // Solo se guardan los precios que cambiaron respecto al último registrado.
  const { data: last } = await supabase
    .from("v_latest_competitor_price")
    .select("product_id, price_crc")
    .eq("competitor_id", competitor);
  const prev = new Map(((last ?? []) as { product_id: number; price_crc: number }[]).map((l) => [l.product_id, l.price_crc]));
  const rows = entries
    .filter((e) => prev.get(e.product_id) !== e.price_crc)
    .map((e) => ({ competitor_id: competitor, product_id: e.product_id, price_crc: e.price_crc, method: "manual" }));

  if (rows.length > 0) {
    const { error } = await supabase.from("competitor_prices").insert(rows);
    if (error) redirect(`${back}&error=guardar`);
  }

  revalidatePath("/admin/competencia");
  redirect(`${back}&ok=${rows.length}`);
}

// ---------------------------------------------------------------------------
// Búsqueda en vivo: consulta las fuentes registradas, normaliza, compara y guarda.
// ---------------------------------------------------------------------------

const emptyResult = (query: string, error: string | null): SearchResult => ({
  ok: false, error, query, durationMs: 0, rows: [], clusters: [], primaryKey: null,
  unavailableCount: 0, otherPresentationCount: 0, statuses: [], saved: false, saveNote: null, searchId: null,
});

type Analysis = ReturnType<typeof analyze>;

async function persist(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  query: string,
  durationMs: number,
  statuses: SourceStatus[],
  a: Analysis
): Promise<{ saved: boolean; note: string | null; searchId: string | null }> {
  const { data: search, error: searchError } = await supabase
    .from("competitor_searches")
    .insert({ query, normalized_query: norm(query), results_count: a.rows.length,
      duration_ms: durationMs, source_status: statuses })
    .select("id")
    .single();
  if (searchError || !search) return { saved: false, note: "No se pudo registrar la búsqueda.", searchId: null };
  const searchId = String(search.id);
  if (!a.rows.length) return { saved: true, note: null, searchId };

  // Competidores: por slug (estable) y, si aún no existe esa columna, por nombre.
  type Store = { id: number; name: string; slug?: string | null };
  let stores: Store[] | null = null;
  const withSlug = await supabase.from("competitors").select("id, name, slug");
  if (!withSlug.error) stores = withSlug.data as Store[];
  else {
    const byNameOnly = await supabase.from("competitors").select("id, name");
    if (byNameOnly.error) return { saved: false, note: "No se pudo leer la lista de competidores.", searchId };
    stores = byNameOnly.data as Store[];
  }
  const bySlug = new Map(stores.filter((x) => x.slug).map((x) => [x.slug as string, Number(x.id)]));
  const byName = new Map(stores.map((x) => [norm(String(x.name)), Number(x.id)]));

  let missingStores = 0;
  const items: Record<string, unknown>[] = [];
  for (const r of a.rows) {
    const competitorId = bySlug.get(r.sourceSlug) ?? byName.get(norm(r.sourceName));
    if (!competitorId || !r.url) { missingStores++; continue; }
    items.push({
      competitor_id: competitorId, product_url: r.url, name: r.name.slice(0, 300), brand: r.brand,
      size_ml: r.sizeMl, pack_count: r.packCount, normalized_key: r.clusterKey,
      presentation: r.sizeMl == null ? null : `${r.sizeMl} ml`,
      price: r.price, compare_price: r.comparePrice, available: r.inStock,
      promo_pct: r.promoPct, promo_text: r.promoText?.slice(0, 200) ?? null,
    });
  }
  if (items.length === 0) return { saved: false, note: `${missingStores} resultados sin competidor asociado.`, searchId };

  // Producto + historial se guardan juntos en la base, en una sola transacción:
  // o queda todo o no queda nada, y repetir la búsqueda no duplica registros.
  const { data, error } = await supabase.rpc("record_competitor_observations", {
    p_search_id: searchId, p_items: items, p_source: "manual_search",
  });
  if (error) {
    const missingFn = error.code === "PGRST202" || error.code === "42883";
    return {
      saved: false,
      searchId,
      note: missingFn
        ? "Falta correr LA14_SQL_PERSISTENCIA_v1.sql en Supabase."
        : `No se pudo guardar el historial (${error.code ?? "error"}).`,
    };
  }

  const r = data as { created: number; updated: number; observations: number; skipped: number };
  const parts = [`${r.created} nuevos`, `${r.updated} con cambios`, `${r.observations} observaciones`];
  if (r.skipped) parts.push(`${r.skipped} omitidos por datos inválidos`);
  if (missingStores) parts.push(`${missingStores} sin competidor asociado`);
  return { saved: true, note: parts.join(" · "), searchId };
}

export async function buscarCompetencia(_prev: SearchResult | null, formData: FormData): Promise<SearchResult> {
  const supabase = await requireAdmin();

  const query = cleanQuery(String(formData.get("q") ?? ""));
  if (!query) return emptyResult("", "Escribe al menos 2 letras (máximo 80).");

  // Freno: máximo 6 búsquedas por minuto, para no saturar a las tiendas.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("competitor_searches")
    .select("id", { count: "exact", head: true })
    .gte("searched_at", since);
  if (count === null) return emptyResult(query, "No fue posible comprobar el límite de búsquedas.");
  if (count >= 6) return emptyResult(query, "Demasiadas búsquedas seguidas. Espera un minuto e intenta de nuevo.");

  const t0 = Date.now();
  const { found, statuses } = await searchAllSources(query);
  const a = analyze(query, found);
  const durationMs = Date.now() - t0;

  const saved = await persist(supabase, query, durationMs, statuses, a);
  revalidatePath("/admin/competencia");

  return {
    ok: true, error: null, query, durationMs,
    rows: a.rows, clusters: a.clusters, primaryKey: a.primaryKey,
    unavailableCount: a.unavailableCount, otherPresentationCount: a.otherPresentationCount,
    statuses, saved: saved.saved, saveNote: saved.note, searchId: saved.searchId,
  };
}
