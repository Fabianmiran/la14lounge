// [LA14 · ENTREGAS · v1] app/admin/entregas/page.tsx
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { createZone } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";

type Z = { id: number; name: string; fee_crc: number; free_over_crc: number | null };
type Pending = {
  id: number; status: string; total_crc: number; paid: boolean;
  customers: { name: string; address: string | null; canton: string | null; whatsapp: string | null } | null;
  delivery_zones: { name: string } | null;
};

export default async function Entregas({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const [zon, pen] = await Promise.all([
    supabase.from("delivery_zones").select("*").order("name"),
    supabase
      .from("orders")
      .select("id, status, total_crc, paid, customers(name, address, canton, whatsapp), delivery_zones(name)")
      .in("status", ["confirmado", "en_ruta"])
      .order("created_at", { ascending: true }),
  ]);
  const zones = (zon.data ?? []) as Z[];
  const pending = (pen.data ?? []) as unknown as Pending[];

  return (
    <>
      <h1 className="font-serif text-3xl">Entregas</h1>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Zona guardada.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">Revisa el nombre e intenta de nuevo.</p>}

      <h2 className="mt-8 font-serif text-2xl">Pendientes de entrega</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Pedidos confirmados o en ruta. Para marcarlos como entregados, ve a Pedidos.
      </p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {pending.length === 0 && <li className="py-4 text-ink-muted">No hay entregas pendientes.</li>}
        {pending.map((o) => (
          <li key={o.id} className="grid grid-cols-[1fr_auto] gap-4 py-3">
            <div>
              <p className="font-serif text-lg">#{o.id} · {o.customers?.name ?? "Sin cliente"}</p>
              <p className="text-xs text-ink-muted">
                {[o.delivery_zones?.name, o.customers?.canton, o.customers?.address].filter(Boolean).join(" · ") || "Sin dirección"}
              </p>
              {o.customers?.whatsapp && <p className="font-mono text-xs text-ink-faint">WhatsApp {o.customers.whatsapp}</p>}
            </div>
            <div className="text-right font-mono text-xs">
              <p className="text-base">{colones(o.total_crc)}</p>
              <p className={o.paid ? "text-ink-muted" : "text-alarm"}>{o.paid ? "Pagado" : "Cobrar al entregar"}</p>
              <p className="text-ink-faint">{o.status === "en_ruta" ? "En ruta" : "Por enviar"}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Zonas y costos de envío</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Esto es lo que el cliente ve en el carrito. Ejemplo: &quot;Heredia centro&quot;, ₡2 000, gratis desde ₡30 000.
      </p>
      <form action={createZone} className="mt-4 grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
        <div>
          <p className={label}>Nombre de la zona *</p>
          <input name="name" required maxLength={80} className={input} />
        </div>
        <div>
          <p className={label}>Costo de envío (₡)</p>
          <input name="fee_crc" inputMode="numeric" defaultValue="0" className={input} />
        </div>
        <div>
          <p className={label}>Envío gratis desde (₡)</p>
          <input name="free_over_crc" inputMode="numeric" className={input} />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit">
          Guardar zona
        </button>
      </form>
      <ul className="mt-4 divide-y divide-rule">
        {zones.length === 0 && <li className="py-4 text-ink-muted">Aún no hay zonas. Crea la primera arriba.</li>}
        {zones.map((z) => (
          <li key={z.id} className="grid grid-cols-[1fr_auto] gap-4 py-3">
            <p className="font-serif text-lg">{z.name}</p>
            <p className="text-right font-mono text-xs text-ink-muted">
              {colones(z.fee_crc)}{z.free_over_crc ? ` · gratis desde ${colones(z.free_over_crc)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
