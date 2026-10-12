// [LA14 · COMPETENCIA · v2] lib/competencia/compare.ts
import { compatible, describe, isRelevant, parseQuery, promoPct, type Described } from "./normalize";
import type { ClusterSummary, FoundItem, PricePoint, ResultRow } from "./types";

type Item = { f: FoundItem; d: Described };

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

function keyOf(rep: Described): string {
  const v = rep.variant.join(" ");
  return `${rep.brand ?? "?"}|${v}|${rep.sizeMl ?? "?"}${rep.packCount > 1 ? "x" + rep.packCount : ""}`;
}

/** Filtra lo que no responde a la búsqueda, agrupa lo que es el mismo producto y compara. */
export function analyze(query: string, found: FoundItem[]) {
  const q = parseQuery(query);

  const items: Item[] = found
    .map((f) => ({ f, d: describe(f.name, f.brand) }))
    .filter((it) => isRelevant(q.required, it.d));

  // Agrupar: el más específico (más palabras) sirve de referencia del grupo.
  const sorted = [...items].sort((a, b) => b.d.variant.length - a.d.variant.length);
  const groups: { rep: Item; members: Item[] }[] = [];
  for (const it of sorted) {
    const g = groups.find((x) => compatible(it.d, x.rep.d));
    if (g) g.members.push(it);
    else groups.push({ rep: it, members: [it] });
  }

  const sources = (m: Item[]) => new Set(m.map((x) => x.f.sourceSlug)).size;

  // Grupo principal: el de la presentación pedida (si la indicó) con más tiendas.
  const wantSize = q.desc.sizeMl;
  const pool = wantSize ? groups.filter((g) => g.rep.d.sizeMl === wantSize) : groups;
  const primary = [...(pool.length ? pool : groups)].sort(
    (a, b) => sources(b.members) - sources(a.members) || b.members.length - a.members.length
  )[0];

  const available = (it: Item) => it.f.price !== null && it.f.inStock !== false;
  const point = (it: Item): PricePoint => ({ price: it.f.price as number, source: it.f.sourceName, url: it.f.url });

  const clusters: ClusterSummary[] = groups.map((g) => {
    const av = g.members.filter(available).sort((a, b) => (a.f.price as number) - (b.f.price as number));
    const min = av[0] ? point(av[0]) : null;
    const max = av.length ? point(av[av.length - 1]) : null;
    const spread = min && max ? max.price - min.price : null;
    return {
      key: keyOf(g.rep.d),
      label: `${g.rep.f.name}`,
      sizeMl: g.rep.d.sizeMl,
      packCount: g.rep.d.packCount,
      count: g.members.length,
      competitors: sources(g.members),
      min, max, spread,
      spreadPct: spread !== null && min ? Math.round((spread / min.price) * 1000) / 10 : null,
      unavailable: g.members.filter((m) => m.f.inStock === false).length,
    };
  });

  const primaryKey = primary ? keyOf(primary.rep.d) : null;

  const rows: ResultRow[] = groups.flatMap((g) => {
    const ck = keyOf(g.rep.d);
    return g.members.map((it) => ({
      sourceSlug: it.f.sourceSlug,
      sourceName: it.f.sourceName,
      name: it.f.name,
      brand: it.d.brand,
      sizeMl: it.d.sizeMl,
      packCount: it.d.packCount,
      price: it.f.price,
      comparePrice: it.f.comparePrice,
      promoPct: promoPct(it.f.price, it.f.comparePrice),
      promoText: it.f.promoText,
      inStock: it.f.inStock,
      url: it.f.url,
      clusterKey: ck,
      isPrimary: ck === primaryKey,
    }));
  });

  // Principal primero; dentro de cada grupo, de menor a mayor precio y los agotados al final.
  rows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.clusterKey !== b.clusterKey) return a.clusterKey < b.clusterKey ? -1 : 1;
    const ua = a.inStock === false || a.price === null ? 1 : 0;
    const ub = b.inStock === false || b.price === null ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return (a.price ?? Infinity) - (b.price ?? Infinity);
  });

  clusters.sort((a, b) => (a.key === primaryKey ? -1 : b.key === primaryKey ? 1 : b.count - a.count));

  return {
    rows,
    clusters,
    primaryKey,
    unavailableCount: rows.filter((r) => r.inStock === false).length,
    otherPresentationCount: rows.filter((r) => !r.isPrimary).length,
    label: (c: ClusterSummary) => titleCase(c.label),
  };
}
