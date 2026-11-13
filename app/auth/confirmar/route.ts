// [LA14 · ACCESO · v1] app/auth/confirmar/route.ts
// Recibe el enlace del correo de "restablecer contraseña", valida el código en el servidor
// y manda a la persona a elegir su nueva contraseña. El enlace es de un solo uso.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type");
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // Solo se acepta el tipo "recovery"; nada más abre sesión por esta ruta.
  if (type !== "recovery" || tokenHash.length < 10 || tokenHash.length > 200) return to("/login?error=enlace");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return to("/login?error=enlace");

  return to("/login/nueva-clave");
}
