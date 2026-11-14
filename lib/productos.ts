// [LA14 · PRODUCTOS · v1] lib/productos.ts
// Lectura segura de lo que se escribe en la pantalla Productos.

// Precio en colones, entero y mayor que 0. Vacío = sin precio (null). Inválido = "invalido".
export function parsePrecio(raw: FormDataEntryValue | null): number | null | "invalido" {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  if (!/^[₡\s\d.,]+$/.test(s)) return "invalido"; // solo símbolo ₡, espacios, dígitos y separadores
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isSafeInteger(n) && n >= 1 && n <= 10_000_000 ? n : "invalido";
}

// Cantidad entera de 0 a 100 000. Vacío = 0. Inválido = null.
export function parseCantidad(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return 0;
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n <= 100_000 ? n : null;
}

// Grado alcohólico 0–96 con hasta 1 decimal. Vacío = null. Inválido = "invalido".
export function parseGrado(raw: FormDataEntryValue | null): number | null | "invalido" {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return null;
  if (!/^\d{1,2}(\.\d)?$/.test(s)) return "invalido";
  const n = Number(s);
  return n >= 0 && n <= 96 ? n : "invalido";
}

// "Brandy y coñac" -> "brandy-y-conac"
export function slugify(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const SAFE_SLUG = /^[a-z0-9-]{0,40}$/;
