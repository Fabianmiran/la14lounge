// [LA14 · SEGURIDAD · v1] app/login/verificar/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyLogin } from "../mfa-actions";

export const metadata: Metadata = {
  title: "Verificación",
  robots: { index: false, follow: false },
};

export default async function Verificar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.[0];
  if (!factor) redirect("/login/activar-2fa");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form action={verifyLogin} className="page-rise w-full max-w-sm space-y-4 border-y-2 border-ink-muted bg-surface p-8">
        <h1 className="text-center font-serif text-3xl">Verificación</h1>
        <p className="text-center text-sm text-ink-muted">
          Escribe el código de 6 dígitos de tu app de autenticación.
        </p>
        {error && <p className="text-center font-mono text-xs text-alarm">Código incorrecto. Intenta de nuevo.</p>}
        <input type="hidden" name="factorId" value={factor.id} />
        <input
          name="code" required inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} pattern="[0-9]{6}" placeholder="000000" autoFocus
          className="w-full border border-rule bg-background p-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-ink-muted"
        />
        <button className="w-full rounded-full bg-ink p-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
          Verificar
        </button>
      </form>
    </main>
  );
}
