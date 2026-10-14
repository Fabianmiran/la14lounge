/**
 * Mega Súper — lector OFFLINE de la página de resultados Next.js Flight.
 * No realiza peticiones de red ni operaciones en Supabase.
 * Los precios obtenidos de CatalogProductModel.price son precios BASE,
 * NO se convierten automáticamente en precios promocionales.
 */
import type { RawItem } from "./types";

type UnknownRecord = Record<string, unknown>;
const asObject = (v: unknown): UnknownRecord | null =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as UnknownRecord)
    : null;

function parseJsonAt(source: string, start: number): unknown {
  const opening = source[start];
  if (opening !== "{" && opening !== "[") return undefined;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      stack.push(c);
    } else if (c === "}" || c === "]") {
      const matching = c === "}" ? "{" : "[";
      if (stack.pop() !== matching) return undefined;
      if (stack.length === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function flightPayload(html: string): string {
  const chunks: string[] = [];
  const re = /<script\b[^>]*>\s*self\.__next_f\.push\((\[[\s\S]*?\])\)\s*<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const data: unknown = JSON.parse(match[1]);
      if (Array.isArray(data) && typeof data[1] === "string") chunks.push(data[1]);
    } catch {
      // Ignorar fragmentos corruptos; las pruebas detectarán los faltantes.
    }
  }
  return chunks.join("");
}

function buildRecords(payload: string): Map<string, unknown> {
  const records = new Map<string, unknown>();
  const header = /(?:^|\s)([0-9a-f]+):(?=[{\[])/gi;
  for (const match of payload.matchAll(header)) {
    const key = match[1].toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const value = parseJsonAt(payload, start);
    if (value !== undefined) records.set(key, value);
  }
  return records;
}

function deref(value: unknown, records: Map<string, unknown>, depth = 0): unknown {
  if (depth > 8 || typeof value !== "string" || !/^\$[0-9a-f]+$/i.test(value)) return value;
  const record = records.get(value.slice(1).toLowerCase());
  return record === undefined ? undefined : deref(record, records, depth + 1);
}

export type MegaSuperDiagnostics = {
  totalDeclared: number;
  productRefs: string[];
  resolvedCount: number;
  basePricesOnly: true;
};

export function parseMegaSuperSearch(
  html: string,
  base: URL = new URL("https://www.megasuper.com"),
): { items: RawItem[]; diagnostics: MegaSuperDiagnostics } {
  if (base.hostname !== "www.megasuper.com" && base.hostname !== "megasuper.com") {
    throw new Error("El lector Mega Súper requiere el dominio megasuper.com");
  }

  const payload = flightPayload(html);
  if (!payload) throw new Error("No se encontraron datos Next.js Flight");

  // Tomar SOLAMENTE la lista de la búsqueda, evitando recomendaciones ajenas.
  const lists = [...payload.matchAll(/"totalProducts":(\d+),"products":(\["\$[0-9a-f]+"(?:,"\$[0-9a-f]+")*\])/gi)];
  if (lists.length === 0) {
    throw new Error("No se identificó la lista de resultados Mega Súper");
  }
  const selected = lists[lists.length - 1];
  const totalDeclared = Number(selected[1]);
  const refs: string[] = JSON.parse(selected[2]);
  const records = buildRecords(payload);
  const items: RawItem[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const product = asObject(deref(ref, records));
    if (!product) continue;
    const name = typeof product.name === "string" ? product.name.trim() : "";
    const slug = typeof product.slug === "string" ? product.slug.trim() : "";
    const price = typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0
      ? Math.round(product.price)
      : null;
    const sku = typeof product.sku === "string" ? product.sku.trim() : "";
    if (!name || !slug || !sku || price === null) continue;
    // Slug controlado; sin URLs externas ni segmentos de ruta.
    if (slug.includes("/") || slug.includes("?") || slug.includes("#")) continue;
    const url = new URL(`/p/${encodeURIComponent(slug)}`, base).toString();
    if (seen.has(sku)) continue;
    seen.add(sku);
    const brandResolved = deref(product.brand, records);
    const brandObj = asObject(brandResolved);
    const brand = typeof brandResolved === "string" ? brandResolved :
      typeof brandObj?.name === "string" ? brandObj.name : null;
    items.push({
      name,
      brand,
      // Del catálogo viene el precio BASE. Una oferta requiere validación adicional.
      price,
      comparePrice: null,
      inStock: typeof product.isAvailable === "boolean" ? product.isAvailable : null,
      url,
      promoText: null,
    });
  }

  return {
    items,
    diagnostics: {
      totalDeclared,
      productRefs: refs,
      resolvedCount: items.length,
      basePricesOnly: true,
    },
  };
}
