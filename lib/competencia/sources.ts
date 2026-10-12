// [LA14 · COMPETENCIA · v2]
// Consultas públicas únicamente. No login, carrito, checkout ni modificaciones.
import type { Competitor, CompetitorResult, SourceSearchResult } from "./types";
import { extractBrand, extractPresentation, matchesQuery, normalizeText } from "./normalize";

const TIMEOUT_MS = 15000;
const UA = "Mozilla/5.0 (compatible; La14Lounge-Competencia/2.0)";

async function getText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/plain;q=0.8" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function money(value: string) {
  const clean = value.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function makeResult(competitor: Competitor, name: string, price: number | null, previousPrice: number | null, available = true, url: string | null = competitor.url, externalId: string | null = null): CompetitorResult {
  const discountPercent = previousPrice && price && previousPrice > price ? Math.round(((previousPrice - price) / previousPrice) * 100) : null;
  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    productName: name.trim(),
    brand: extractBrand(name),
    presentation: extractPresentation(name),
    externalId,
    price,
    previousPrice,
    discountPercent,
    available,
    promotion: Boolean(discountPercent),
    url,
  };
}

function parseWalmart(text: string, competitor: Competitor, query: string, sourceUrl: string) {
  const results: CompetitorResult[] = [];
  const normalizedQuery = normalizeText(query);
  const blocks = text.match(/[^.]{0,240}(?:₡|CRC)[^.]{0,240}/gi) ?? [];
  for (const block of blocks) {
    if (!normalizeText(block).includes(normalizedQuery) && !matchesQuery(block, query)) continue;
    const prices = block.match(/₡\s*[\d.,]+/g)?.map(money).filter((n): n is number => n !== null) ?? [];
    if (!prices.length) continue;
    const current = prices.at(-1) ?? null;
    const previous = prices.length > 1 ? prices.at(-2) ?? null : null;
    const name = block.replace(/₡\s*[\d.,]+/g, " ").replace(/-\s*\d+%/g, " ").replace(/\s+/g, " ").trim();
    results.push(makeResult(competitor, name || query, current, previous, true, sourceUrl));
  }
  return results.slice(0, 20);
}

function parseGeneric(text: string, competitor: Competitor, query: string, sourceUrl: string) {
  const results: CompetitorResult[] = [];
  const normalizedQuery = normalizeText(query);
  const chunks = text.split(/(?=₡|CRC|SKU:|Disponible|No disponible)/i);
  for (const chunk of chunks) {
    if (!normalizeText(chunk).includes(normalizedQuery) && !matchesQuery(chunk, query)) continue;
    const prices = chunk.match(/₡\s*[\d.,]+/g)?.map(money).filter((n): n is number => n !== null) ?? [];
    if (!prices.length) continue;
    const current = prices.at(-1) ?? null;
    const previous = prices.length > 1 ? prices.at(-2) ?? null : null;
    const sku = chunk.match(/SKU:\s*([A-Z0-9_-]+)/i)?.[1] ?? null;
    const available = !/no disponible|agotado|out of stock/i.test(chunk);
    const name = chunk.replace(/SKU:\s*[A-Z0-9_-]+/gi, " ").replace(/₡\s*[\d.,]+/g, " ").replace(/Disponible/gi, " ").replace(/No disponible/gi, " ").replace(/Agregar al carrito/gi, " ").replace(/\s+/g, " ").trim();
    if (name) results.push(makeResult(competitor, name, current, previous, available, sourceUrl, sku));
  }
  return results.slice(0, 20);
}

async function searchMiniZeus(competitor: Competitor, query: string): Promise<SourceSearchResult> {
  // El catálogo es paginado y público. Consultamos las primeras páginas para búsqueda manual.
  const pages = Array.from({ length: 23 }, (_, i) => i + 1);
  const settled = await Promise.all(pages.map(async (page) => {
    try {
      const url = page === 1 ? competitor.url! : `https://www.minisuperzeus.com/?pagina=${page}`;
      return { url, text: htmlToText(await getText(url)) };
    } catch { return null; }
  }));
  const results = settled.flatMap((item) => item ? parseGeneric(item.text, competitor, query, item.url) : []);
  const unique = new Map<string, CompetitorResult>();
  for (const result of results) unique.set(`${result.externalId ?? ""}|${normalizeText(result.productName)}|${result.presentation ?? ""}`, result);
  return { results: [...unique.values()].slice(0, 20), ...(results.length ? {} : { error: "No se encontraron coincidencias o la fuente no respondió." }) };
}

export async function searchSource(competitor: Competitor, query: string): Promise<SourceSearchResult> {
  if (!competitor.url) return { results: [], error: "Fuente sin URL" };
  try {
    if (competitor.name === "Mini Súper Zeus") return await searchMiniZeus(competitor, query);
    if (competitor.name === "Walmart") {
      const slug = normalizeText(query).replace(/\s+/g, "-");
      const url = `https://www.walmart.co.cr/${slug}`;
      return { results: parseWalmart(htmlToText(await getText(url)), competitor, query, url) };
    }
    if (competitor.name === "PriceSmart") {
      const url = `https://www.pricesmart.com/es-cr/busqueda?q=${encodeURIComponent(query)}`;
      return { results: parseGeneric(htmlToText(await getText(url)), competitor, query, url) };
    }

    // Mega Súper, Vinum y Habla: sus páginas públicas de categoría/ofertas se consultan sin autenticación.
    const text = htmlToText(await getText(competitor.url));
    const results = parseGeneric(text, competitor, query, competitor.url);
    return results.length ? { results } : { results: [], error: "No se encontraron coincidencias en la página pública consultada." };
  } catch (error) {
    return { results: [], error: error instanceof Error ? error.message : "Error de consulta" };
  }
}
