// [LA14 · COMPETENCIA · v2] lib/competencia/types.ts
export type SourceState = "ok" | "sin_resultados" | "error" | "bloqueado" | "pendiente";

export type SourceStatus = {
  slug: string;
  name: string;
  state: SourceState;
  message: string | null;
  ms: number;
  count: number;
};

/** Lo que devuelve cada tienda, sin normalizar. */
export type RawItem = {
  name: string;
  brand: string | null;
  price: number | null;        // colones enteros
  comparePrice: number | null; // precio anterior (tachado)
  inStock: boolean | null;     // null = la tienda no lo informa
  url: string;
  promoText: string | null;
};

export type FoundItem = RawItem & { sourceSlug: string; sourceName: string };

export type ResultRow = {
  sourceSlug: string;
  sourceName: string;
  name: string;
  brand: string | null;
  sizeMl: number | null;
  packCount: number;
  price: number | null;
  comparePrice: number | null;
  promoPct: number | null;
  promoText: string | null;
  inStock: boolean | null;
  url: string;
  clusterKey: string;
  isPrimary: boolean;
};

export type PricePoint = { price: number; source: string; url: string };

export type ClusterSummary = {
  key: string;
  label: string;
  sizeMl: number | null;
  packCount: number;
  count: number;
  competitors: number;
  min: PricePoint | null;
  max: PricePoint | null;
  spread: number | null;
  spreadPct: number | null;
  unavailable: number;
};

export type SearchResult = {
  ok: boolean;
  error: string | null;
  query: string;
  durationMs: number;
  rows: ResultRow[];
  clusters: ClusterSummary[];
  primaryKey: string | null;
  unavailableCount: number;
  otherPresentationCount: number;
  statuses: SourceStatus[];
  saved: boolean;
  saveNote: string | null;
  searchId: string | null;
};
