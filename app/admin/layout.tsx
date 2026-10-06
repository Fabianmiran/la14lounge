// [LA14 · BASE · v1] app/admin/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Segunda barrera de seguridad (la primera es proxy.ts).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/login?error=1");

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-3xl">La 14 Lounge</span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
            Panel
          </span>
        </div>
        <form action={logout}>
          <button className="rounded-full border border-ink-muted px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] hover:bg-surface">
            Salir
          </button>
        </form>
      </header>

      <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-rule pb-3 text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-ink">Resumen</Link>
        <Link href="/admin/pedidos" className="hover:text-ink">Pedidos</Link>
        <Link href="/admin/clientes" className="hover:text-ink">Clientes</Link>
        <Link href="/admin/proveedores" className="hover:text-ink">Proveedores</Link>
        <Link href="/admin/entregas" className="hover:text-ink">Entregas</Link>
        <Link href="/" className="ml-auto hover:text-ink">Ver sitio →</Link>
      </nav>

      <div className="page-rise mt-6">{children}</div>
    </div>
  );
}
