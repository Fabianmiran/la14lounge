// [LA14 · COMPETENCIA · v2] lib/competencia/normalize.ts
// Convierte nombres desordenados ("Fireball Cinnamon Whisky 750 ML",
// "FIREBALL WHISKY 0.75L", "Whisky Fireball 750ml") en datos comparables.

export const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function norm(s: string): string {
  return strip(s)
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9.,%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanQuery(raw: string): string | null {
   
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return s.length >= 2 ? s : null;
}

// Palabras que describen la categoría o rellenan, no al producto.
const STOP = new Set([
  "de", "del", "la", "el", "los", "las", "con", "en", "y", "a", "para", "por", "sabor", "sabores",
  "botella", "bot", "importado", "importada", "nacional", "original", "licor", "licores",
  "whisky", "whiskey", "wiski", "ron", "rhum", "vodka", "vodca", "tequila", "ginebra", "gin",
  "vino", "cerveza", "aguardiente", "brandy", "cognac", "conac", "champana", "champagne",
  "caja", "pack", "unidad", "und", "ml", "lt", "litro", "cl", "oz", "alc", "vol", "no",
]);

// Español -> inglés, para que "canela" y "cinnamon" sean lo mismo.
const SYN: Record<string, string> = {
  canela: "cinnamon", miel: "honey", manzana: "apple", negro: "black", negra: "black",
  rojo: "red", roja: "red", azul: "blue", verde: "green", dorado: "gold", dorada: "gold",
  limon: "lemon", coco: "coconut", vainilla: "vanilla", durazno: "peach", cereza: "cherry",
  fresa: "strawberry", pina: "pineapple", naranja: "orange", mango: "mango",
};

const FLAVOR = new Set([
  "cinnamon", "honey", "apple", "vanilla", "coconut", "cherry", "lemon", "peach", "mango",
  "strawberry", "pineapple", "orange", "lime", "blueberry", "watermelon", "passion", "banana",
  "caramel", "chocolate", "coffee", "fire", "spiced",
]);

// Sabor "de fábrica" de una marca (Fireball sin sabor indicado = canela).
const BRAND_DEFAULT_FLAVOR: Record<string, string[]> = { fireball: ["cinnamon"] };

const BRAND_LIST: Record<string, string[]> = {
  fireball: ["fireball"],
  "jack daniels": ["jack daniel"],
  "jim beam": ["jim beam"],
  "johnnie walker": ["johnnie walker", "johnny walker"],
  "chivas regal": ["chivas regal", "chivas"],
  buchanans: ["buchanan"],
  "old parr": ["old parr"],
  ballantines: ["ballantine"],
  jameson: ["jameson"],
  "crown royal": ["crown royal"],
  "makers mark": ["maker mark"],
  glenfiddich: ["glenfiddich"],
  glenlivet: ["glenlivet"],
  macallan: ["macallan"],
  dewars: ["dewar"],
  absolut: ["absolut"],
  smirnoff: ["smirnoff"],
  "grey goose": ["grey goose"],
  ciroc: ["ciroc"],
  "ketel one": ["ketel one"],
  stolichnaya: ["stolichnaya", "stoli"],
  bacardi: ["bacardi"],
  "captain morgan": ["captain morgan"],
  "havana club": ["havana club"],
  "flor de cana": ["flor de cana"],
  zacapa: ["zacapa"],
  diplomatico: ["diplomatico"],
  appleton: ["appleton"],
  "don julio": ["don julio"],
  patron: ["patron"],
  "jose cuervo": ["jose cuervo", "cuervo"],
  herradura: ["herradura"],
  "1800": ["1800"],
  hendricks: ["hendrick"],
  tanqueray: ["tanqueray"],
  bombay: ["bombay"],
  beefeater: ["beefeater"],
  gordons: ["gordon"],
  baileys: ["bailey"],
  jagermeister: ["jagermeister", "jager"],
  campari: ["campari"],
  aperol: ["aperol"],
  martini: ["martini"],
  cinzano: ["cinzano"],
  malibu: ["malibu"],
  kahlua: ["kahlua"],
  heineken: ["heineken"],
  imperial: ["imperial"],
  pilsen: ["pilsen"],
  corona: ["corona"],
  budweiser: ["budweiser"],
  "stella artois": ["stella artois"],
  guinness: ["guinness"],
  cacique: ["cacique"],
  centenario: ["centenario"],
  nicoya: ["nicoya"],
  moet: ["moet chandon", "moet"],
  "veuve clicquot": ["veuve clicquot"],
  "casillero del diablo": ["casillero del diablo"],
};

const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const toks = (s: string) => norm(s).split(" ").filter(Boolean).map(stem);

type BrandRule = { canon: string; alias: string[] };
const BRANDS: BrandRule[] = Object.entries(BRAND_LIST)
  .flatMap(([canon, aliases]) => aliases.map((a) => ({ canon, alias: toks(a) })))
  .sort((a, b) => b.alias.length - a.alias.length);

function findBrand(tokens: string[]): { canon: string; idx: number[] } | null {
  for (const b of BRANDS) {
    for (let i = 0; i + b.alias.length <= tokens.length; i++) {
      if (b.alias.every((t, k) => tokens[i + k] === t)) {
        return { canon: b.canon, idx: b.alias.map((_, k) => i + k) };
      }
    }
  }
  return null;
}

export type Described = {
  brand: string | null;
  brandTokens: string[];
  sizeMl: number | null;
  packCount: number;
  variant: string[];   // lo que distingue al producto dentro de la marca
  all: Set<string>;    // todas las palabras (para saber si responde a la búsqueda)
};

const PACK_RE = /(\d{1,2})\s*x\s*(?=\d)|\bx\s*(\d{1,2})\b|(\d{1,2})\s*(?:pack|pk|unidades|unids?|und|uds?)\b|\bcaja\s*(?:de\s*)?(\d{1,2})\b/;
const SIZE_RE = /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(ml|mls|cc|cl|lts?|litros?|l|oz)\b/;

function unitToMl(n: number, unit: string): number {
  if (unit === "cl") return n * 10;
  if (unit === "oz") return n * 29.5735;
  if (unit.startsWith("l")) return unit === "l" || unit.startsWith("lt") || unit.startsWith("litro") ? n * 1000 : n;
  return n; // ml, mls, cc
}

export function describe(name: string, brandHint?: string | null): Described {
  let t = norm(name);

  let packCount = 1;
  const pm = t.match(PACK_RE);
  if (pm) {
    const n = Number(pm[1] ?? pm[2] ?? pm[3] ?? pm[4]);
    if (n >= 2 && n <= 48) packCount = n;
    t = t.replace(pm[0], " ");
  }

  let sizeMl: number | null = null;
  const sm = t.match(SIZE_RE);
  if (sm) {
    const ml = Math.round(unitToMl(parseFloat(sm[1].replace(",", ".")), sm[2]));
    if (ml >= 20 && ml <= 20000) sizeMl = ml;
    t = t.replace(sm[0], " ");
  }

  t = t
    .replace(/\d+(?:[.,]\d+)?\s*(?:%|grados|gl\b)/g, " ")
    .replace(/(\d+)\s*(?:anos|ano|years|year|yo)\b/g, "$1 ")
    .replace(/[.,%]/g, " ");

  const tokens = t.split(" ").filter(Boolean).map(stem).map((w) => SYN[w] ?? w);

  let b = findBrand(tokens);
  if (!b && brandHint) {
    const hint = findBrand(toks(brandHint));
    if (hint) {
      const present = BRANDS.find((r) => r.canon === hint.canon && r.alias.every((a) => tokens.includes(a)));
      if (present) b = { canon: hint.canon, idx: tokens.flatMap((w, i) => (present.alias.includes(w) ? [i] : [])) };
    }
  }

  const brandIdx = new Set(b?.idx ?? []);
  const brandTokens = tokens.filter((_, i) => brandIdx.has(i));
  const variant = [...new Set(tokens.filter((w, i) => !brandIdx.has(i) && !STOP.has(w) && !/^\d{3,}$/.test(w)))].sort();

  const all = new Set(tokens);
  if (b && BRAND_DEFAULT_FLAVOR[b.canon] && !variant.some((w) => FLAVOR.has(w))) {
    BRAND_DEFAULT_FLAVOR[b.canon].forEach((f) => all.add(f));
  }

  return { brand: b?.canon ?? null, brandTokens, sizeMl, packCount, variant, all };
}

function effectiveFlavors(d: Described): Set<string> {
  const f = d.variant.filter((w) => FLAVOR.has(w));
  if (f.length === 0 && d.brand && BRAND_DEFAULT_FLAVOR[d.brand]) return new Set(BRAND_DEFAULT_FLAVOR[d.brand]);
  return new Set(f);
}

/** ¿Es el mismo producto y la misma presentación? */
export function compatible(a: Described, b: Described): boolean {
  if (a.sizeMl !== b.sizeMl || a.packCount !== b.packCount) return false;

  const bothBrand = a.brand && b.brand;
  if (bothBrand && a.brand !== b.brand) return false;
  if ((a.brand && !b.brand) || (!a.brand && b.brand)) return false;

  const fa = effectiveFlavors(a);
  const fb = effectiveFlavors(b);
  if (fa.size !== fb.size || [...fa].some((x) => !fb.has(x))) return false;

  const ra = a.variant.filter((w) => !FLAVOR.has(w));
  const rb = b.variant.filter((w) => !FLAVOR.has(w));
  if (!a.brand && !b.brand && (ra.length === 0 || rb.length === 0)) return false;
  if (ra.length === 0 || rb.length === 0) return true;

  const sa = new Set(ra);
  const sb = new Set(rb);
  const inter = ra.filter((w) => sb.has(w)).length;
  if (inter === sa.size || inter === sb.size) return true; // uno contiene al otro
  return inter / (sa.size + sb.size - inter) >= 0.5;
}

/** Qué palabras debe contener un resultado para responder a la búsqueda. */
export function parseQuery(q: string) {
  const d = describe(q);
  const required = [...d.brandTokens, ...d.variant];
  const fallback = [...d.all].filter((w) => !/^\d+$/.test(w));
  return { desc: d, required: required.length > 0 ? required : fallback };
}

export function isRelevant(required: string[], d: Described): boolean {
  return required.every((w) => d.all.has(w));
}

// ---------- precios ----------

/** Acepta 12990, "12.970", "₡12 970", 12970.00 ... y devuelve colones enteros. */
export function toPrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[₡$\s]|CRC/gi, "");
  if (!s) return null;
  let n: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ""));
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) n = parseFloat(s.replace(",", "."));
  else return null;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function promoPct(price: number | null, compare: number | null): number | null {
  if (!price || !compare || compare <= price) return null;
  return Math.round((1 - price / compare) * 100);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}
