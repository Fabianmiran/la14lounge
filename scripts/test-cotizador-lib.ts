// [LA14 · COTIZADOR · v1] Prueba de las utilidades del cotizador (sin base de datos).
import assert from "node:assert/strict";
import { parseDiscount, waNumber, whatsappText, isExpired, fechaCR } from "../lib/cotizador";

assert.equal(parseDiscount(null), 0);
assert.equal(parseDiscount(""), 0);
assert.equal(parseDiscount("10"), 10);
assert.equal(parseDiscount("7,5"), 7.5);
assert.equal(parseDiscount("100"), 100);
for (const bad of ["101", "-5", "abc", "1.234", "1e2", "10%"]) assert.equal(parseDiscount(bad), null, bad);

assert.equal(waNumber("8888-7777"), "50688887777");
assert.equal(waNumber("+506 8888 7777"), "50688887777");
assert.equal(waNumber("123"), "");
assert.equal(waNumber(null), "");

assert.equal(isExpired("2000-01-01"), true);
assert.equal(isExpired("2999-01-01"), false);
assert.match(fechaCR("2026-11-09"), /2026/);

const t = whatsappText(
  { quote_number: "C-0001", customer_name: "Bar El Faro", zone_name: "Heredia", delivery_fee: 0, subtotal_crc: 66000, total_crc: 66000, valid_until: "2026-11-16", notes: null },
  [{ name: "Ron A", size_ml: 750, qty: 2, unit_price_crc: 18000, list_price_crc: 20000, discount_pct: 10 }],
);
assert.match(t, /C-0001/);
assert.match(t, /Envío \(Heredia\): gratis/);
assert.ok(!/costo|proveedor|margen/i.test(t), "el mensaje al cliente no debe mencionar costos");
console.log("OK: utilidades del cotizador");
