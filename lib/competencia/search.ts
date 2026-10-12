// [LA14 · COMPETENCIA · v2]
import { requireAdmin } from "@/lib/admin";
import { searchSource } from "./sources";
import type { Competitor, CompetitorResult } from "./types";

export async function searchCompetitors(query: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.from("competitors").select("id, name, channel, url").order("id");
  if (error) throw new Error("No se pudieron cargar las fuentes de competencia.");

  const competitors = (data ?? []) as Competitor[];
  const settled = await Promise.all(competitors.map((competitor) => searchSource(competitor, query)));
  const results: CompetitorResult[] = [];
  const errors: { competitor: string; error: string }[] = [];
  settled.forEach((result, index) => {
    results.push(...result.results);
    if (result.error) errors.push({ competitor: competitors[index].name, error: result.error });
  });

  const lowest = [...results].filter((r) => r.price !== null).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] ?? null;

  const { data: searchRow } = await supabase.from("competitor_searches").insert({ query, results_count: results.length }).select("id").single();
  if (searchRow?.id) {
    for (const result of results) {
      if (result.price === null) continue;
      let existingQuery = supabase.from("competitor_products").select("id, current_price, available, previous_price").eq("competitor_id", result.competitorId);
      if (result.externalId) existingQuery = existingQuery.eq("external_id", result.externalId);
      else existingQuery = existingQuery.eq("name", result.productName).eq("presentation", result.presentation ?? "");
      const { data: existing } = await existingQuery.maybeSingle();
      const payload = {
        competitor_id: result.competitorId,
        external_id: result.externalId,
        name: result.productName,
        brand: result.brand,
        presentation: result.presentation,
        product_url: result.url,
        current_price: result.price,
        previous_price: result.previousPrice,
        available: result.available,
        promotion: result.promotion,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      let productId = existing?.id as string | undefined;
      if (productId) await supabase.from("competitor_products").update(payload).eq("id", productId);
      else {
        const inserted = await supabase.from("competitor_products").insert(payload).select("id").single();
        productId = inserted.data?.id;
      }
      if (productId) {
        await supabase.from("competitor_price_history").insert({ competitor_product_id: productId, price: result.price, previous_price: result.previousPrice, available: result.available, promotion: result.promotion, discount_percent: result.discountPercent });
      }
    }
  }

  return { results, errors, lowest };
}
