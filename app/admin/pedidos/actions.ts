// [LA14 · VENTAS · v1] app/admin/pedidos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";

const CHANNELS = ["manual", "whatsapp", "web"];
const PAYMENTS = ["sinpe", "efectivo", "tarjeta"];
const NEXT = ["confirmado", "en_ruta", "entregado", "cancelado"];

export async function createOrder(formData: FormData) {
  const supabase = await requireAdmin();

  const items: { product_id: number; qty: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const product_id = int(formData, `product_${i}`);
    const qty = int(formData, `qty_${i}`);
    if (product_id && qty && qty >= 1 && qty <= 999) items.push({ product_id, qty });
  }
  if (items.length === 0) redirect("/admin/pedidos?error=vacio");

  const channel = txt(formData, "channel", 12) ?? "manual";
  const payment = txt(formData, "payment_method", 12);

  const { error } = await supabase.rpc("create_order", {
    p_customer: int(formData, "customer_id"),
    p_zone: int(formData, "zone_id"),
    p_channel: CHANNELS.includes(channel) ? channel : "manual",
    p_payment: payment && PAYMENTS.includes(payment) ? payment : null,
    p_items: items,
  });
  if (error) redirect("/admin/pedidos?error=guardar");

  revalidatePath("/admin/pedidos");
  redirect("/admin/pedidos?ok=1");
}

export async function changeStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const id = int(formData, "order_id");
  const status = txt(formData, "status", 12);
  if (!id || !status || !NEXT.includes(status)) redirect("/admin/pedidos?error=guardar");

  // Para entregar, hay que confirmar que se verificó la mayoría de edad.
  if (status === "entregado" && formData.get("age_ok") !== "on")
    redirect("/admin/pedidos?error=edad");

  const { error } = await supabase.rpc("set_order_status", { p_order: id, p_status: status });
  if (error) redirect("/admin/pedidos?error=guardar");

  revalidatePath("/admin/pedidos");
  redirect("/admin/pedidos?ok=1");
}

export async function markPaid(formData: FormData) {
  const supabase = await requireAdmin();
  const id = int(formData, "order_id");
  if (!id) redirect("/admin/pedidos?error=guardar");

  const { error } = await supabase.from("orders").update({ paid: true }).eq("id", id);
  if (error) redirect("/admin/pedidos?error=guardar");

  revalidatePath("/admin/pedidos");
  redirect("/admin/pedidos?ok=1");
}
