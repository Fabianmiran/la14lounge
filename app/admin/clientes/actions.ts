// [LA14 · VENTAS · v1] app/admin/clientes/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { txt } from "@/lib/forms";

export async function createCustomer(formData: FormData) {
  const supabase = await requireAdmin();

  const name = txt(formData, "name", 120);
  if (!name) redirect("/admin/clientes?error=nombre");

  const email = txt(formData, "email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    redirect("/admin/clientes?error=correo");

  const wa = (txt(formData, "whatsapp", 20) ?? "").replace(/\D/g, "") || null;
  const type = txt(formData, "type", 12) === "negocio" ? "negocio" : "particular";

  const { error } = await supabase.from("customers").insert({
    name,
    phone: txt(formData, "phone", 30),
    whatsapp: wa,
    email,
    type,
    address: txt(formData, "address", 300),
    canton: txt(formData, "canton", 80),
  });
  if (error) redirect(`/admin/clientes?error=${error.code === "23505" ? "repetido" : "guardar"}`);

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes?ok=1");
}
