// [LA14 · COMPETENCIA · v2]
export type Competitor = {
  id: number;
  name: string;
  channel: string | null;
  url: string | null;
};

export type CompetitorResult = {
  competitorId: number;
  competitorName: string;
  productName: string;
  brand: string | null;
  presentation: string | null;
  externalId: string | null;
  price: number | null;
  previousPrice: number | null;
  discountPercent: number | null;
  available: boolean | null;
  promotion: boolean;
  url: string | null;
};

export type SourceSearchResult = {
  results: CompetitorResult[];
  error?: string;
};

export type MonitorSnapshot = CompetitorResult & {
  checkedAt: string;
};
