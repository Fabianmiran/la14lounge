// [LA14 · COMPETENCIA · v2]
const PRESENTATION_RE = /(?:\b|^)(\d+(?:[.,]\d+)?)\s*(ml|mL|l|L|cl|cL)\b/;

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function extractPresentation(value: string) {
  const match = value.match(PRESENTATION_RE);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return null;
  const ml = unit === "l" ? amount * 1000 : unit === "cl" ? amount * 10 : amount;
  return `${Number.isInteger(ml) ? ml : ml.toFixed(0)} ml`;
}

export function samePresentation(a: string | null, b: string | null) {
  if (!a || !b) return true;
  return normalizeText(a) === normalizeText(b);
}

export function queryTokens(query: string) {
  return normalizeText(query).split(/\s+/).filter(Boolean).filter((token) => !/^\d+(ml|l|cl)$/.test(token));
}

export function matchesQuery(name: string, query: string) {
  const haystack = normalizeText(name);
  const tokens = queryTokens(query);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

export function extractBrand(name: string) {
  const brands = ["fireball", "jack daniel's", "jack daniels", "smirnoff", "baileys", "jagermeister", "jose cuervo", "absolut", "bacardi", "titos", "tito's", "johnnie walker", "buchanans", "chivas regal", "captain morgan", "malibu", "aperol", "campari", "corona", "imperial", "stella artois"];
  const normalized = normalizeText(name);
  return brands.find((brand) => normalized.includes(normalizeText(brand))) ?? null;
}
