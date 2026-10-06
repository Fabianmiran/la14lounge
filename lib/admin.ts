// [LA14 · BASE · v2] lib/admin.ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Se llama al inicio de CADA acción del panel: si no eres el administrador, no pasa.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/login?error=1");
  return supabase;
}
