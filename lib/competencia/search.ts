// [LA14 · COMPETENCIA · v2] lib/competencia/search.ts
import { decodeEntities, toPrice } from "./normalize";
import { SOURCES, type Adapter, type Source } from "./sources";
import type { FoundItem, RawItem, SourceStatus } from "./types";
import { parseMegaSuperSearch } from "./megasuper";

// Identificación honesta: no nos hacemos pasar por un navegador.
const UA = "La14LoungeBot/1.0 (consulta manual de precios por el administrador)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

type J = Record<string, unknown>;
const obj = (v: unknown): J | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function absUrl(href: string | null, base: URL): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------- HTTP con límites ----------------

const host = (h: string) => h.replace(/^www\./, "");

async function getText(url: string, base: URL, ms = TIMEOUT_MS, max = MAX_BYTES): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": UA,
        accept: "application/json, text/html;q=0.9, */*;q=0.5",
        "accept-language": "es-CR,es;q=0.9",
      },
    });
    if (host(new URL(res.url || url).hostname) !== host(base.hostname)) throw new Error("Redirigió a otro sitio");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) return (await res.text()).slice(0, max);
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        ctrl.abort();
        throw new Error("Respuesta demasiado grande");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf-8");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Tiempo de espera agotado");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- robots.txt ----------------

type Rule = { allow: boolean; re: RegExp; len: number };
const robotsCache = new Map<string, { at: number; rules: Rule[] }>();

const toRe = (p: string) => {
  const end = p.endsWith("$");
  const body = (end ? p.slice(0, -1) : p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + body + (end ? "$" : ""));
};

export function parseRobots(txt: string): Rule[] {
  const rules: Rule[] = [];
  let agents: string[] = [];
  let inAgents = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === "user-agent") {
      if (!inAgents) agents = [];
      inAgents = true;
      agents.push(v.toLowerCase());
      continue;
    }
    inAgents = false;
    if ((k === "allow" || k === "disallow") && v && agents.some((a) => a === "*" || a === "la14loungebot")) {
      rules.push({ allow: k === "allow", re: toRe(v), len: v.length });
    }
  }
  return rules;
}

export function robotsVerdict(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (r.re.test(pathAndQuery) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
  }
  return best ? best.allow : true;
}

async function robotsAllows(base: URL, pathAndQuery: string): Promise<boolean> {
  let entry = robotsCache.get(base.origin);
  if (!entry || Date.now() - entry.at > 3_600_000) {
    let rules: Rule[] = [];
    try {
      rules = parseRobots(await getText(`${base.origin}/robots.txt`, base, 4000, 300_000));
    } catch {
      /* sin robots.txt: se asume permitido */
    }
    entry = { at: Date.now(), rules };
    robotsCache.set(base.origin, entry);
  }
  return robotsVerdict(entry.rules, pathAndQuery);
}

// ---------------- lectores por plataforma ----------------

export function parseVtex(data: unknown, base: URL): RawItem[] {
  const out: RawItem[] = [];
  for (const p of arr(data)) {
    const o = obj(p);
    const name = str(o?.productName);
    if (!o || !name) continue;

    type Offer = { price: number; list: number; qty: number; promo: string | null };
    const offers: Offer[] = [];
    for (const it of arr(o.items))
      for (const s of arr(obj(it)?.sellers)) {
        const c = obj(obj(s)?.commertialOffer);
        if (!c) continue;
        const hl = obj(arr(c.DiscountHighLight)[0]);
        offers.push({
          price: Number(c.Price) || 0,
          list: Number(c.ListPrice) || 0,
          qty: Number(c.AvailableQuantity) || 0,
          promo: hl ? (Object.values(hl).find((x) => typeof x === "string") as string | undefined) ?? null : null,
        });
      }
    const pick = offers.find((x) => x.qty > 0 && x.price > 0) ?? offers[0];
    const url = absUrl(str(o.link) ?? (str(o.linkText) ? `/${o.linkText}/p` : null), base);
    if (!url) continue;

    out.push({
      name,
      brand: str(o.brand),
      price: pick && pick.price > 0 ? Math.round(pick.price) : null,
      comparePrice: pick && pick.list > pick.price && pick.price > 0 ? Math.round(pick.list) : null,
      inStock: pick ? pick.qty > 0 : null,
      url,
      promoText: pick?.promo ?? null,
    });
  }
  return out;
}

export function parseShopify(data: unknown, base: URL): RawItem[] {
  const list = arr(obj(obj(obj(data)?.resources)?.results)?.products);
  const out: RawItem[] = [];
  for (const p of list) {
    const o = obj(p);
    const name = str(o?.title);
    const url = absUrl(str(o?.url)?.split("?")[0] ?? null, base);
    if (!o || !name || !url) continue;
    const price = toPrice(o.price);
    const cmp = toPrice(o.compare_at_price_max);
    out.push({
      name,
      brand: str(o.vendor),
      price,
      comparePrice: price && cmp && cmp > price ? cmp : null,
      inStock: typeof o.available === "boolean" ? o.available : null,
      url,
      promoText: null,
    });
  }
  return out;
}

export function parseWoo(data: unknown, base: URL): RawItem[] {
  const out: RawItem[] = [];
  for (const p of arr(data)) {
    const o = obj(p);
    const name = str(o?.name);
    const url = absUrl(str(o?.permalink), base);
    const pr = obj(o?.prices);
    if (!o || !name || !url || !pr) continue;
    const minor = Number(pr.currency_minor_unit ?? 2);
    const conv = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n / 10 ** (Number.isFinite(minor) ? minor : 2)) : null;
    };
    const price = conv(pr.price);
    const regular = conv(pr.regular_price);
    out.push({
      name: decodeEntities(name),
      brand: null,
      price,
      comparePrice: price && regular && regular > price ? regular : null,
      inStock: typeof o.is_in_stock === "boolean" ? o.is_in_stock : null,
      url,
      promoText: o.on_sale === true ? "En oferta" : null,
    });
  }
  return out;
}

export function parseJsonLd(html: string, base: URL): RawItem[] {
  const out: RawItem[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const isType = (o: J, t: string) => {
    const ty = o["@type"];
    return ty === t || (Array.isArray(ty) && ty.includes(t));
  };

  const add = (o: J) => {
    const name = str(o.name);
    const offersRaw = o.offers;
    const offer = obj(Array.isArray(offersRaw) ? offersRaw[0] : offersRaw);
    if (!name || !offer) return;
    const specification = obj(
      Array.isArray(offer.priceSpecification)
        ? offer.priceSpecification[0]
        : offer.priceSpecification
);

    const price = toPrice(
     offer.price ?? specification?.price ?? offer.lowPrice
);
    const avail = str(offer.availability);
    const brand = typeof o.brand === "string" ? o.brand : str(obj(o.brand)?.name);
    const url = absUrl(str(o.url) ?? str(offer.url), base);
    if (!url) return;
    out.push({
      name: decodeEntities(name),
      brand,
      price,
      comparePrice: null,
      inStock: avail ? (/InStock|LimitedAvailability|PreOrder/i.test(avail) ? true : /OutOfStock|SoldOut|Discontinued/i.test(avail) ? false : null) : null,
      url,
      promoText: null,
    });
  };

  const walk = (node: unknown, depth = 0) => {
    if (depth > 6) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const o = obj(node);
    if (!o) return;
    if (o["@graph"]) walk(o["@graph"], depth + 1);
    if (isType(o, "Product")) add(o);
    if (isType(o, "ItemList")) arr(o.itemListElement).forEach((el) => walk(obj(el)?.item ?? el, depth + 1));
  };

  for (const m of html.matchAll(re)) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      /* bloque inválido: se ignora */
    }
  }
  return out;
}

// ---------------- ejecución por fuente ----------------

function buildUrl(base: URL, ad: Adapter, q: string): string {
  const e = encodeURIComponent(q);
  switch (ad.kind) {
    case "vtex":
      return `${base.origin}/api/catalog_system/pub/products/search?ft=${e}&_from=0&_to=23`;
    case "shopify":
      return `${base.origin}/search/suggest.json?q=${e}&resources[type]=product&resources[limit]=20&resources[options][unavailable_products]=last`;
    case "woocommerce":
      return `${base.origin}/wp-json/wc/store/v1/products?search=${e}&per_page=20`;
    case "jsonld":
      return `${base.origin}${ad.searchPath.replace(/\{q\}/g, e)}`;
      case "megasuper":
      return `${base.origin}/search?name=${e}`;
  }
}

function parseWith(ad: Adapter, text: string, base: URL): RawItem[] {
  if (ad.kind === "jsonld") {
    return parseJsonLd(text, base);
  }

  if (ad.kind === "megasuper") {
    return parseMegaSuperSearch(text, base).items;
  }

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("La respuesta no es JSON");
  }

  return ad.kind === "vtex"
    ? parseVtex(data, base)
    : ad.kind === "shopify"
      ? parseShopify(data, base)
      : parseWoo(data, base);
}

async function runSource(src: Source, q: string): Promise<{ items: FoundItem[]; status: SourceStatus }> {
  const t0 = Date.now();
  const status = (state: SourceStatus["state"], message: string | null, count = 0): SourceStatus => ({
    slug: src.slug, name: src.name, state, message, ms: Date.now() - t0, count,
  });

  if (!src.baseUrl) return { items: [], status: status("pendiente", "Falta la dirección web en sources.ts") };

  let base: URL;
  try {
    base = new URL(src.baseUrl);
  } catch {
    return { items: [], status: status("error", "La dirección de la fuente no es válida") };
  }

  let blocked = 0;
  let reached = false;
  let lastError: string | null = null;

  for (const ad of src.adapters) {
    const target = buildUrl(base, ad, q);
    try {
      const u = new URL(target);
      if (!(await robotsAllows(base, u.pathname + u.search))) {
        blocked++;
        continue;
      }
      const items = parseWith(ad, await getText(target, base), base);
      reached = true;
      if (items.length > 0) {
        const seen = new Set<string>();
        const unique = items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true))).slice(0, 40);
        return {
          items: unique.map((i) => ({ ...i, sourceSlug: src.slug, sourceName: src.name })),
          status: status("ok", `Método: ${ad.kind}`, unique.length),
        };
      }
    } catch (e) {
      lastError = `${ad.kind}: ${e instanceof Error ? e.message : "error"}`;
    }
  }

  if (reached) return { items: [], status: status("sin_resultados", null) };
  if (blocked > 0 && !lastError) return { items: [], status: status("bloqueado", "El robots.txt de la tienda no permite esta consulta") };
  return { items: [], status: status("error", lastError ?? "No se pudo consultar") };
}

/** Consulta todas las fuentes al mismo tiempo; una que falle no afecta a las demás. */
export async function searchAllSources(q: string): Promise<{ found: FoundItem[]; statuses: SourceStatus[] }> {
  const results = await Promise.all(SOURCES.map((s) => runSource(s, q)));
  return { found: results.flatMap((r) => r.items), statuses: results.map((r) => r.status) };
}
