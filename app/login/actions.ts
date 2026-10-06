// [LA14 · SEGURIDAD · v1] app/login/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function clientIp() {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
  return raw.slice(0, 64);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const ip = await clientIp();

  // Demasiados intentos fallidos desde esta IP: se frena por 15 minutos.
  const { data: allowed } = await supabase.rpc("login_allowed", { p_ip: ip });
  if (allowed === false) redirect("/login?error=bloqueado");

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").slice(0, 254),
    password: String(formData.get("password") ?? "").slice(0, 200),
  });
  if (error) {
    await supabase.rpc("log_login_failure", { p_ip: ip });
    redirect("/login?error=1");
  }

  // Segundo factor: código de 6 dígitos del celular.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/login/verificar");
  if (aal?.currentLevel !== "aal2") redirect("/login/activar-2fa");
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
