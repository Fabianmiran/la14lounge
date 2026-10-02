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

  const stats = [
    { label: "Productos", value: productos },
    { label: "Proveedores", value: proveedores },
    { label: "Clientes", value: clientes },
    { label: "Pedidos", value: pedidos },
  ];

  return (
    <section className="grid grid-cols-2 divide-x divide-rule border-y-2 border-ink-muted sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="px-6 py-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {s.label}
          </div>
          <div className="mt-2 font-mono text-[44px] leading-none tracking-tight">
            {s.value}
          </div>
        </div>
      ))}
    </section>
  );
}
