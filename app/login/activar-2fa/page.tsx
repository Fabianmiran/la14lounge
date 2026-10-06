// [LA14 · SEGURIDAD · v1] app/login/activar-2fa/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyEnroll } from "../mfa-actions";

export const metadata: Metadata = {
  title: "Activar verificación en dos pasos",
  robots: { index: false, follow: false },
};

export default async function Activar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase.rpc("is_admin_member");
  if (!member) redirect("/login?error=1");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp?.length) redirect("/login/verificar"); // ya está activado

  // Limpia intentos anteriores sin terminar y crea un código QR nuevo.
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `La14-${Date.now()}`,
  });
  if (enrollError || !enroll) redirect("/login?error=1");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <form action={verifyEnroll} className="page-rise w-full max-w-sm space-y-4 border-y-2 border-ink-muted bg-surface p-8">
        <h1 className="text-center font-serif text-3xl">Activar verificación</h1>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>Abre tu app de autenticación (Google Authenticator, Authy o 1Password).</li>
          <li>Escanea este código QR.</li>
          <li>Escribe aquí el código de 6 dígitos que te muestra.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enroll.totp.qr_code} alt="Código QR para activar la verificación" className="mx-auto h-48 w-48 bg-white p-2" />
        <p className="break-all text-center font-mono text-[11px] text-ink-faint">
          Si no puedes escanear, usa esta clave: {enroll.totp.secret}
        </p>
        {error && <p className="text-center font-mono text-xs text-alarm">Código incorrecto. Escanea el QR nuevo e intenta de nuevo.</p>}
        <input type="hidden" name="factorId" value={enroll.id} />
        <input
          name="code" required inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} pattern="[0-9]{6}" placeholder="000000"
          className="w-full border border-rule bg-background p-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-ink-muted"
        />
        <button className="w-full rounded-full bg-ink p-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">
          Activar y entrar
        </button>
      </form>
    </main>
  );
}
