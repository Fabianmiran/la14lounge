import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-8"
      >
        <h1 className="text-center text-2xl font-bold text-amber-400">
          La 14 Lounge
        </h1>
        <p className="text-center text-sm text-neutral-400">Acceso privado</p>

        {error && (
          <p className="rounded bg-red-950 p-2 text-center text-sm text-red-300">
            Correo o contraseña incorrectos.
          </p>
        )}

        <input
          name="email"
          type="email"
          required
          placeholder="Correo"
          className="w-full rounded border border-neutral-700 bg-neutral-950 p-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Contraseña"
          className="w-full rounded border border-neutral-700 bg-neutral-950 p-2"
        />
        <button
          type="submit"
          className="w-full rounded bg-amber-500 p-2 font-semibold text-neutral-950 hover:bg-amber-400"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
