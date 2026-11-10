// [LA14 · COTIZADOR · v1] lib/cotizador.ts
// Utilidades del cotizador. Nada de aquí lee costos: es seguro para la vista del cliente.
import { colones } from "@/lib/forms";

export const QUOTE_STATUS: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada",
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fecha de hoy en Costa Rica (yyyy-mm-dd), para comparar con valid_until.
export const hoyCR = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());

export const isExpired = (validUntil: string) => validUntil < hoyCR();

export const fechaCR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
};

// Número de WhatsApp para wa.me: solo dígitos; si son 8 (Costa Rica), antepone 506.
export const waNumber = (raw: string | null | undefined) => {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 8) return "506" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
};

export type ClientLine = { name: string; size_ml: number | null; qty: number; unit_price_crc: number; list_price_crc: number; discount_pct: number };
export type ClientQuote = {
  quote_number: string; customer_name: string | null; zone_name: string | null; delivery_fee: number;
  subtotal_crc: number; total_crc: number; valid_until: string; notes: string | null;
};

export function whatsappText(q: ClientQuote, lines: ClientLine[]) {
  const out = [
    `*La 14 Lounge* — Cotización ${q.quote_number}`,
    q.customer_name ? `Para: ${q.customer_name}` : "",
    "",
    ...lines.map((l) => `• ${l.qty} × ${l.name}${l.size_ml ? ` (${l.size_ml} ml)` : ""} — ${colones(l.unit_price_crc * l.qty)}`),
    "",
    `Subtotal: ${colones(q.subtotal_crc)}`,
    q.zone_name ? `Envío (${q.zone_name}): ${q.delivery_fee === 0 ? "gratis" : colones(q.delivery_fee)}` : "",
    `*Total: ${colones(q.total_crc)}* (IVA incluido)`,
    `Válida hasta el ${fechaCR(q.valid_until)}.`,
    q.notes ? `\n${q.notes}` : "",
    "\nPrecios sujetos a disponibilidad. Venta solo a mayores de 18 años.",
  ];
  return out.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n").trim();
}

// Descuento en % con hasta 2 decimales, entre 0 y 100. Vacío = 0.
export function parseDiscount(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}
