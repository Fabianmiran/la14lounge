// [LA14 · COTIZADOR · v1] app/admin/pedidos/cotizaciones/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";
import { UUID_RE, parseDiscount } from "@/lib/cotizador";

const BASE = "/admin/pedidos/cotizaciones";
const PAYMENTS = ["sinpe", "efectivo", "tarjeta"];
const LINES = 10;

export async function createQuote(formData: FormData) {
  const supabase = await requireAdmin();

  const items: { product_id: number; qty: number; discount_pct: number }[] = [];
  for (let i = 1; i <= LINES; i++) {
    const product_id = int(formData, `product_${i}`);
    const qty = int(formData, `qty_${i}`);
    if (!product_id && !qty) continue;
    const discount = parseDiscount(formData.get(`discount_${i}`));
    if (!product_id || !qty || qty < 1 || qty > 999 || discount === null) redirect(`${BASE}?error=linea`);
    items.push({ product_id, qty, discount_pct: discount });
  }
  if (items.length === 0) redirect(`${BASE}?error=vacio`);

  const days = int(formData, "valid_days") ?? 7;
  const margin = Number(String(formData.get("min_margin") ?? "10").replace(",", "."));
  if (days < 1 || days > 60) redirect(`${BASE}?error=vigencia`);
  if (!Number.isFinite(margin) || margin < 0 || margin > 90) redirect(`${BASE}?error=margen`);

  const { data, error } = await supabase.rpc("create_quote", {
    p_customer: int(formData, "customer_id"),
    p_customer_name: txt(formData, "customer_name", 120),
    p_zone: int(formData, "zone_id"),
    p_valid_days: days,
    p_notes: txt(formData, "notes", 500),
    p_items: items,
    p_min_margin: margin,
  });
  if (error || typeof data !== "string" || !UUID_RE.test(data)) redirect(`${BASE}?error=guardar`);

  revalidatePath(BASE);
  redirect(`${BASE}/${data}`);
}

export async function setQuoteStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("quote_id") ?? "");
  const status = txt(formData, "status", 12);
  if (!UUID_RE.test(id) || (status !== "enviada" && status !== "rechazada")) redirect(`${BASE}?error=guardar`);

  const { error } = await supabase.rpc("set_quote_status", { p_quote: id, p_status: status });
  if (error) redirect(`${BASE}/${id}?error=cerrada`);

  revalidatePath(BASE);
  redirect(`${BASE}/${id}?ok=1`);
}

export async function acceptQuote(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("quote_id") ?? "");
  if (!UUID_RE.test(id)) redirect(`${BASE}?error=guardar`);
  const pay = txt(formData, "payment_method", 12);

  const { error } = await supabase.rpc("accept_quote", {
    p_quote: id,
    p_payment: pay && PAYMENTS.includes(pay) ? pay : null,
  });
  if (error) redirect(`${BASE}/${id}?error=${/vencida/.test(error.message) ? "vencida" : "cerrada"}`);

  revalidatePath(BASE);
  revalidatePath("/admin/pedidos");
  redirect("/admin/pedidos?ok=1");
}
