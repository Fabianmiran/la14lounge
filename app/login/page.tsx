// [LA14 · ACCESO · v1] app/login/page.tsx (antes SEGURIDAD v1; añade avisos de contraseña nueva)
import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Acceso privado",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        action={login}
        className="page-rise w-full max-w-sm space-y-4 border-y-2 border-ink-muted bg-surface p-8"
      >
        <h1 className="text-center font-serif text-3xl">La 14 Lounge</h1>
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Acceso privado
        </p>

        {ok === "clave" && (
          <p className="text-center font-mono text-xs text-ink-muted">
            ✓ Contraseña actualizada. Ya puedes entrar.
          </p>
        )}
        {error === "enlace" ? (
          <p className="text-center font-mono text-xs text-alarm">
            El enlace venció o ya se usó. Pide uno nuevo.
          </p>
        ) : error === "bloqueado" ? (
          <p className="text-center font-mono text-xs text-alarm">
            Demasiados intentos. Espera 15 minutos e intenta de nuevo.
          </p>
        ) : error ? (
          <p className="text-center font-mono text-xs text-alarm">
            Correo o contraseña incorrectos.
          </p>
        ) : null}

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Correo"
          className="w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Contraseña"
          className="w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-ink p-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
