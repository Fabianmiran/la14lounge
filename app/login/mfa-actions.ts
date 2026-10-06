// [LA14 · SEGURIDAD · v1] app/login/mfa-actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function read(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "").slice(0, 64);
  const code = String(formData.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  return { factorId, code };
}

// Entrar con el código cuando el 2FA ya está activado.
export async function verifyLogin(formData: FormData) {
  const { factorId, code } = read(formData);
  if (!factorId || code.length !== 6) redirect("/login/verificar?error=1");

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) redirect("/login/verificar?error=1");
  redirect("/admin");
}

// Activar el 2FA por primera vez (confirma con el primer código).
export async function verifyEnroll(formData: FormData) {
  const { factorId, code } = read(formData);
  if (!factorId || code.length !== 6) redirect("/login/activar-2fa?error=1");

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) redirect("/login/activar-2fa?error=1");
  redirect("/admin");
}
