// [LA14 · ACCESO · v1] lib/clave.ts
// Reglas de contraseña. bcrypt (Supabase) solo usa los primeros 72 bytes: por eso el tope.
export type ClaveError = "corta" | "larga" | "distintas" | "simple" | null;

export function validarClave(a: string, b: string): ClaveError {
  if (a !== b) return "distintas";
  if (a.length < 12) return "corta";
  if (new TextEncoder().encode(a).length > 72) return "larga";
  if (new Set(a).size < 5) return "simple"; // ej. "aaaaaaaaaaaa" o "121212121212"
  return null;
}
