// [LA14 · ACCESO · v1] app/login/nueva-clave/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cambiarClave } from "../clave-actions";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false, follow: false } };

const MSG: Record<string, string> = {
  corta: "Debe tener al menos 12 caracteres.",
  larga: "Es demasiado larga (máximo 72 caracteres).",
  distintas: "Las dos contraseñas no coinciden.",
  simple: "Es muy simple: mezcla letras, números y símbolos.",
  guardar: "No se pudo guardar. Pide un enlace nuevo.",
};
const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";

export default async function NuevaClave({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=enlace");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form action={cambiarClave} className="page-rise w-full max-w-sm space-y-4 border-y-2 border-ink-muted bg-surface p-8">
        <h1 className="text-center font-serif text-3xl">Nueva contraseña</h1>
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">La 14 Lounge · acceso privado</p>
        {error && <p className="text-center font-mono text-xs text-alarm">{MSG[error] ?? "Revisa los datos."}</p>}
        <input name="clave" type="password" required minLength={12} maxLength={72} autoComplete="new-password" placeholder="Nueva contraseña (mín. 12)" className={input} />
        <input name="clave2" type="password" required minLength={12} maxLength={72} autoComplete="new-password" placeholder="Repítela" className={input} />
        <button type="submit" className="w-full rounded-full bg-ink p-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
          Guardar contraseña
        </button>
      </form>
    </main>
  );
}
