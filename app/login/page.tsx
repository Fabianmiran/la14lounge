import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Acceso privado",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

        {error && (
          <p className="text-center font-mono text-xs text-alarm">
            Correo o contraseña incorrectos.
          </p>
        )}

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
