// [LA14 · PROVEEDORES · v1] app/admin/proveedores/precios/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int } from "@/lib/forms";

export async function addPrice(formData: FormData) {
  const supabase = await requireAdmin();

  const supplier_id = int(formData, "supplier_id");
  const product_id = int(formData, "product_id");
  const cost_crc = int(formData, "cost_crc");
  const min_qty = int(formData, "min_qty") ?? 1;
  const freight_crc = int(formData, "freight_crc") ?? 0;

  if (!supplier_id || !product_id || !cost_crc || cost_crc < 1 || min_qty < 1)
    redirect("/admin/proveedores/precios?error=datos");

  const { error } = await supabase.from("supplier_prices").insert({
    supplier_id,
    product_id,
    cost_crc,
    min_qty,
    freight_crc,
    source: "manual",
  });
  if (error) redirect("/admin/proveedores/precios?error=guardar");

  revalidatePath("/admin/proveedores/precios");
  redirect("/admin/proveedores/precios?ok=1");
}
