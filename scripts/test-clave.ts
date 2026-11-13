// [LA14 · ACCESO · v1] Prueba de las reglas de contraseña.
import assert from "node:assert/strict";
import { validarClave } from "../lib/clave";

assert.equal(validarClave("Cafe-Lounge-2026!", "Cafe-Lounge-2026!"), null);
assert.equal(validarClave("Cafe-Lounge-2026!", "Cafe-Lounge-2026"), "distintas");
assert.equal(validarClave("corta1!", "corta1!"), "corta");
assert.equal(validarClave("a".repeat(12), "a".repeat(12)), "simple");
assert.equal(validarClave("121212121212", "121212121212"), "simple");
assert.equal(validarClave("x1!".repeat(30), "x1!".repeat(30)), "larga");
assert.equal(validarClave("ñ".repeat(37) + "abcd", "ñ".repeat(37) + "abcd"), "larga"); // 37*2+4 = 78 bytes
assert.equal(validarClave("", ""), "corta");
console.log("OK: reglas de contraseña");
