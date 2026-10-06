// [LA14 · ENTREGAS · v1] app/admin/entregas/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";

export async function createZone(formData: FormData) {
  const supabase = await requireAdmin();
  const name = txt(formData, "name", 80);
  if (!name) redirect("/admin/entregas?error=nombre");

  const { error } = await supabase.from("delivery_zones").insert({
    name,
    fee_crc: int(formData, "fee_crc") ?? 0,
    free_over_crc: int(formData, "free_over_crc"),
  });
  if (error) redirect("/admin/entregas?error=guardar");

  revalidatePath("/admin/entregas");
  redirect("/admin/entregas?ok=1");
}
