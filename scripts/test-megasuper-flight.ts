import { readFileSync } from "node:fs";
import { parseMegaSuperSearch } from "../lib/competencia/megasuper";

const file = process.argv[2] ?? "/tmp/la14-megasuper-busqueda.html";
const html = readFileSync(file, "utf8");
const { items, diagnostics } = parseMegaSuperSearch(html);

console.log("=== MEGA SÚPER / TEST LOCAL ===");
console.log(JSON.stringify(diagnostics, null, 2));
console.table(items.map((p) => ({
  nombre: p.name,
  precioBase: p.price,
  disponible: p.inStock,
  url: p.url,
})));

if (diagnostics.totalDeclared !== 5 || diagnostics.resolvedCount !== 5) {
  throw new Error(`Se esperaban 5 resultados, se extrajeron ${diagnostics.resolvedCount}`);
}
const lynchburg = items.find((p) => p.name.includes("LYNCHBURG"));
if (!lynchburg || lynchburg.price !== 28200 || lynchburg.inStock !== true) {
  throw new Error("Validación de Lynchburg fallida");
}
const honey = items.find((p) => p.name.includes("HONEY"));
if (!honey || honey.inStock !== false) {
  throw new Error("Validación de inventario Honey fallida");
}
console.log("OK: Cinco productos identificados; precios base y disponibilidad validados.");
console.log("NOTA: Promociones NO aplicadas. Sin red ni escrituras de base de datos.");
