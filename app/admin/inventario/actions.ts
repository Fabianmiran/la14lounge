// [LA14 · INVENTARIO · v1] app/admin/inventario/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";

const TIPOS: Record<string, { reason: string; sign: 1 | -1 }> = {
  compra: { reason: "compra", sign: 1 },
  merma: { reason: "merma", sign: -1 },
  "ajuste+": { reason: "ajuste", sign: 1 },
  "ajuste-": { reason: "ajuste", sign: -1 },
};

export async function registerStock(formData: FormData) {
  const supabase = await requireAdmin();
  const product = int(formData, "product_id");
  const qty = int(formData, "qty");
  const tipo = TIPOS[txt(formData, "tipo", 10) ?? ""];
  if (!product || !qty || !tipo) redirect("/admin/inventario?error=datos");

  const { error } = await supabase.rpc("register_stock", {
    p_product: product,
    p_qty: qty * tipo.sign,
    p_reason: tipo.reason,
    p_note: txt(formData, "note", 200),
  });
  if (error) redirect("/admin/inventario?error=guardar");

  revalidatePath("/admin/inventario");
  redirect("/admin/inventario?ok=1");
}

export async function setMinStock(formData: FormData) {
  const supabase = await requireAdmin();
  const id = int(formData, "product_id");
  if (!id) redirect("/admin/inventario?error=datos");

  const { error } = await supabase
    .from("products")
    .update({ min_stock: int(formData, "min_stock") ?? 0 })
    .eq("id", id);
  if (error) redirect("/admin/inventario?error=guardar");

  revalidatePath("/admin/inventario");
  redirect("/admin/inventario?ok=1");
}
