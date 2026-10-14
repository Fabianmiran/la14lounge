import { readFileSync } from "node:fs";
import { parseJsonLd } from "../lib/competencia/search";

const html = readFileSync(
  "/tmp/la14-megasuper-producto.html",
  "utf8"
);

const base = new URL("https://www.megasuper.com");
const products = parseJsonLd(html, base);

const product = products.find((item) =>
  item.url.includes("082184090466")
);

if (!product) {
  throw new Error("No se encontró el producto de Mega Súper");
}

console.log(JSON.stringify(product, null, 2));

if (product.price !== 22500) {
  throw new Error(`Precio incorrecto: ${product.price}`);
}

if (product.inStock !== true) {
  throw new Error("Disponibilidad incorrecta");
}

console.log("OK: Extracción Mega Súper validada.");
