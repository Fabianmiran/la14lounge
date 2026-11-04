import { readFileSync } from "node:fs";
import { analyze } from "../lib/competencia/compare";
import { parseMegaSuperSearch } from "../lib/competencia/megasuper";
import type { FoundItem } from "../lib/competencia/types";

const htmlPath = "fixtures/la14-megasuper-busqueda.html";

const html = readFileSync(htmlPath, "utf8");

const megasuper: FoundItem[] = parseMegaSuperSearch(
  html,
  new URL("https://www.megasuper.com")
).items.map((item) => ({
  ...item,
  sourceSlug: "mega-super",
  sourceName: "Mega Súper",
}));

// Precio ficticio de Walmart, únicamente para pruebas.
const walmart: FoundItem[] = [
  {
    sourceSlug: "walmart",
    sourceName: "Walmart (SIMULADO)",
    name: "WHISKY JACK DANIELS LYNCHBURG 750 ML",
    brand: "JACK DANIELS",
    price: 27900,
    comparePrice: null,
    inStock: true,
    url: "https://example.invalid/walmart/jack-daniels",
    promoText: null,
  },
];

const result = analyze("jack daniels", [
  ...megasuper,
  ...walmart,
]);

console.log("\n=== PRODUCTOS ENCONTRADOS ===");

console.table(
  result.rows.map((row) => ({
    producto: row.name,
    tienda: row.sourceName,
    precio: row.price,
    disponible: row.inStock,
    grupo: row.clusterKey,
  }))
);

console.log("\n=== COMPARACIÓN POR PRODUCTO ===");

console.table(
  result.clusters.map((cluster) => ({
    producto: cluster.label,
    tiendas: cluster.competitors,
    precioMinimo: cluster.min?.price ?? null,
    precioMaximo: cluster.max?.price ?? null,
    diferencia: cluster.spread,
  }))
);

const variants = ["LYNCHBURG", "APPLE", "HONEY"];

const groupKeys = variants.map((variant) =>
  result.rows.find((row) =>
    row.name.toUpperCase().includes(variant)
  )?.clusterKey
);

if (groupKeys.some((key) => !key)) {
  throw new Error("No se encontraron todas las variedades.");
}

if (new Set(groupKeys).size !== variants.length) {
  throw new Error("El comparador mezcló variedades diferentes.");
}

console.log("\nOK: Las variedades están separadas.");
console.log("OK: Prueba de integración completada.");
console.log("Consultas externas: 0");
console.log("Escrituras Supabase: 0");
