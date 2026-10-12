// [LA14 · MONITOR UNIFICADO · FASE 4] Solo lectura: sin conexión a Supabase.
// Ejecutar desde la raíz del proyecto con: npx tsx scripts/monitor-competencia.ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyze } from "../lib/competencia/compare";
import { cleanQuery } from "../lib/competencia/normalize";
import { searchAllSources } from "../lib/competencia/search";
import type { FoundItem } from "../lib/competencia/types";

const args = new Set(process.argv.slice(2));
const supported = new Set(["--live", "--offline", "--help"]);
if ([...args].some((arg) => !supported.has(arg))) {
  console.error("Argumento desconocido. Solo se permiten --offline y --live. Nunca se escribe en Supabase.");
  process.exit(2);
}
if (args.has("--help")) {
  console.log("Uso: npx tsx scripts/monitor-competencia.ts [--offline | --live]");
  process.exit(0);
}
if (args.has("--live") && args.has("--offline")) {
  console.error("Seleccioná solo un modo.");
  process.exit(2);
}
const live = args.has("--live"); // Predeterminado: offline (sin red).

function mockItems(q: string): FoundItem[] {
  // Muestras SOLAMENTE para validar el flujo; no son precios reales.
  if (!/fireball/i.test(q)) return [];
  return [
    { sourceSlug: "walmart", sourceName: "Walmart (simulado)", name: "Fireball Cinnamon Whisky 750 ML", brand: "Fireball", price: 12000, comparePrice: null, inStock: true, url: "https://example.invalid/walmart/fireball", promoText: null },
    { sourceSlug: "vinum", sourceName: "Vinum (simulado)", name: "FIREBALL WHISKY 0.75L", brand: "Fireball", price: 12500, comparePrice: 13500, inStock: true, url: "https://example.invalid/vinum/fireball", promoText: "Muestra" },
  ];
}

async function main() {
  // Las búsquedas se definen manualmente en archivo local, nunca se recuperan de producción.
  const configPath = resolve(process.cwd(), "config/monitor-productos.json");
  const raw: unknown = JSON.parse(await readFile(configPath, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 6 || raw.some((v) => typeof v !== "string" || !cleanQuery(v))) {
    throw new Error("config/monitor-productos.json debe contener entre 1 y 6 consultas válidas (texto de 2 a 80 caracteres).");
  }
  console.log(`LA14 · Monitor Fase 4 · ${live ? "SIMULACIÓN CON CONSULTAS PÚBLICAS" : "SIMULACIÓN SIN RED"}`);
  console.log("Sin credenciales, sin guardar en Supabase, sin correos y sin escrituras.");
  const overview = [];
  for (const [i, q] of raw.entries()) {
    if (live && i > 0) await new Promise((r) => setTimeout(r, 11_000)); // <=6 consultas/minuto
    const query = cleanQuery(q as string)!;
    const start = Date.now();
    const result = live ? await searchAllSources(query) : { found: mockItems(query), statuses: [] };
    const analysis = analyze(query, result.found);
    const entry = {
      query,
      durationMs: Date.now() - start,
      received: result.found.length,
      relevant: analysis.rows.length,
      sources: result.statuses.map(({ name, state, message, count }) => ({ name, state, message, count })),
      firstMatches: analysis.rows.slice(0, 5).map(({ sourceName, name, price, inStock }) => ({ sourceName, name, price, inStock })),
    };
    overview.push(entry);
    console.log(JSON.stringify(entry, null, 2));
  }
  const failing = overview.flatMap((r) => r.sources).filter((s) => s.state === "error" || s.state === "bloqueado");
  console.log(JSON.stringify({ mode: live ? "live-readonly" : "offline", queries: overview.length, failingSources: failing.length, databaseWrites: 0 }, null, 2));
}

main().catch((error: unknown) => {
  console.error("Monitor simulado falló:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
