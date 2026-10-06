// [LA14 · PROVEEDORES · v1] app/admin/proveedores/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";

const TERMS = ["Contado", "8 días", "15 días", "30 días"];

export async function createSupplier(formData: FormData) {
  const supabase = await requireAdmin();

  const name = txt(formData, "name", 120);
  if (!name) redirect("/admin/proveedores?error=nombre");

  const email = txt(formData, "email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    redirect("/admin/proveedores?error=correo");

  const terms = txt(formData, "payment_terms", 20);

  const { error } = await supabase.from("suppliers").insert({
    name,
    contact_name: txt(formData, "contact_name", 120),
    phone: txt(formData, "phone", 30),
    email,
    payment_terms: terms && TERMS.includes(terms) ? terms : null,
    min_order_crc: int(formData, "min_order_crc"),
    delivery_notes: txt(formData, "delivery_notes", 500),
  });
  if (error) redirect("/admin/proveedores?error=guardar");

  revalidatePath("/admin/proveedores");
  redirect("/admin/proveedores?ok=1");
}
