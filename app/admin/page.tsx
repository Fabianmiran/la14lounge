import { createClient } from "@/lib/supabase/server";

async function contar(tabla: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from(tabla)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminHome() {
  const [productos, proveedores, clientes, pedidos] = await Promise.all([
    contar("products"),
    contar("suppliers"),
    contar("customers"),
    contar("orders"),
  ]);

  const tarjetas = [
    { titulo: "Productos", valor: productos },
    { titulo: "Proveedores", valor: proveedores },
    { titulo: "Clientes", valor: clientes },
    { titulo: "Pedidos", valor: pedidos },
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Resumen</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div
            key={t.titulo}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <p className="text-sm text-neutral-400">{t.titulo}</p>
            <p className="mt-1 text-3xl font-bold text-amber-400">{t.valor}</p>
          </div>
        ))}
      </div>
    </>
  );
}
