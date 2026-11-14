// [LA14 · PRODUCTOS · v1] Prueba de las lecturas de la pantalla Productos.
import assert from "node:assert/strict";
import { parsePrecio, parseCantidad, parseGrado, slugify, SAFE_SLUG } from "../lib/productos";

assert.equal(parsePrecio(""), null);
assert.equal(parsePrecio(null), null);
assert.equal(parsePrecio("14900"), 14900);
assert.equal(parsePrecio("₡14 900"), 14900);
assert.equal(parsePrecio("14.900"), 14900);
assert.equal(parsePrecio("14,900"), 14900);
for (const bad of ["0", "-5", "abc", "1e5", "14900;drop", "10000001", "₡0"]) assert.equal(parsePrecio(bad), "invalido", bad);

assert.equal(parseCantidad(""), 0);
assert.equal(parseCantidad("12"), 12);
assert.equal(parseCantidad("100000"), 100000);
for (const bad of ["-1", "1.5", "abc", "100001", "1e3", "1234567"]) assert.equal(parseCantidad(bad), null, bad);

assert.equal(parseGrado(""), null);
assert.equal(parseGrado("40"), 40);
assert.equal(parseGrado("37,5"), 37.5);
for (const bad of ["97", "abc", "40.55", "-1"]) assert.equal(parseGrado(bad), "invalido", bad);

assert.equal(slugify("Brandy y coñac"), "brandy-y-conac");
assert.equal(slugify("  Licores & Cremas! "), "licores-cremas");
assert.equal(slugify("***"), "");
assert.ok(SAFE_SLUG.test("ron") && SAFE_SLUG.test("") && !SAFE_SLUG.test("Ron;") && !SAFE_SLUG.test("a".repeat(41)));
console.log("OK: lecturas de Productos");
