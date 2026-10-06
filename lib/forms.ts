// [LA14 · BASE · v1] lib/forms.ts
// Limpieza de lo que escribe el usuario en los formularios.
export const txt = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? "").trim().slice(0, max);
  return v === "" ? null : v;
};

// Solo enteros positivos razonables (montos en colones, cantidades, ids).
export const int = (f: FormData, k: string) => {
  const raw = String(f.get(k) ?? "").replace(/[^\d]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= 100_000_000 ? n : null;
};

export const colones = (n: number) => "₡" + n.toLocaleString("es-CR");
