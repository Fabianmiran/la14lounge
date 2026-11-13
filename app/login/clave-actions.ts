// [LA14 · ACCESO · v1] app/login/clave-actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validarClave } from "@/lib/clave";

export async function cambiarClave(formData: FormData) {
  const supabase = await createClient();

  // Solo puede cambiarla quien llegó con un enlace válido del correo (o ya tiene sesión).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=enlace");

  const a = String(formData.get("clave") ?? "").slice(0, 200);
  const b = String(formData.get("clave2") ?? "").slice(0, 200);
  const problema = validarClave(a, b);
  if (problema) redirect(`/login/nueva-clave?error=${problema}`);

  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) redirect("/login/nueva-clave?error=guardar");

  // Se cierra la sesión: entra con su nueva contraseña y su código del celular.
  await supabase.auth.signOut();
  redirect("/login?ok=clave");
}
