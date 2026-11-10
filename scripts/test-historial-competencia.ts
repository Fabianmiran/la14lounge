import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMegaSuperSearch } from "../lib/competencia/megasuper";
import type { RawItem } from "../lib/competencia/types";

type SavedProduct = {
  name: string;
  price: number;
  available: boolean | null;
};

const products = new Map<string, SavedProduct>();
const history: Array<{
  product: string;
  price: number;
  previousPrice: number | null;
  available: boolean | null;
}> = [];

function processItems(items: RawItem[]) {
  let created = 0;
  let updated = 0;
  let observations = 0;

  for (const item of items) {
    if (item.price === null || !Number.isFinite(item.price) || item.price < 0) {
      continue;
    }

    const key = `mega-super|${item.url}`;
    const previous = products.get(key);

    if (!previous) {
      created++;
    } else if (previous.price !== item.price || previous.available !== item.inStock) {
      updated++;
    } else {
      continue;
    }

    products.set(key, {
      name: item.name,
      price: item.price,
      available: item.inStock,
    });

    history.push({
      product: item.name,
      price: item.price,
      previousPrice: previous?.price ?? null,
      available: item.inStock,
    });

    observations++;
  }

  return { created, updated, observations };
}

const fixturePath = resolve(process.cwd(), "fixtures/la14-megasuper-busqueda.html");
const html = readFileSync(fixturePath, "utf8");
const result = parseMegaSuperSearch(html, new URL("https://www.megasuper.com"));

if (result.items.length !== 5) {
  throw new Error(`Se esperaban 5 productos; encontrados: ${result.items.length}`);
}

console.log("=== PRIMERA EJECUCIÓN ===");
const first = processItems(result.items);
console.log(first);

console.log("\n=== SEGUNDA EJECUCIÓN ===");
const second = processItems(result.items);
console.log(second);

console.log("\n=== HISTORIAL SIMULADO ===");
console.table(history);

if (
  first.created !== 5 ||
  first.observations !== 5 ||
  second.created !== 0 ||
  second.updated !== 0 ||
  second.observations !== 0
) {
  throw new Error("Error en el control de duplicados");
}

console.log("\nOK: Registro inicial validado.");
console.log("OK: Sin duplicados en la segunda ejecución.");
console.log("NOTA: El script contempla cambios de disponibilidad, pero aún no los simula.");
console.log("Consultas externas: 0");
console.log("Escrituras en Supabase: 0");
