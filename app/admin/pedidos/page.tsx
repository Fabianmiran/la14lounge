// [LA14 · VENTAS · v1] app/admin/pedidos/page.tsx
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { changeStatus, createOrder, markPaid } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const ERRORS: Record<string, string> = {
  vacio: "Agrega al menos un producto con cantidad.",
  edad: "Para entregar debes confirmar que verificaste la mayoría de edad.",
  guardar: "No se pudo completar. Revisa que los productos tengan precio de venta.",
};
const STATUS: Record<string, string> = {
  nuevo: "Nuevo", confirmado: "Confirmado", en_ruta: "En ruta", entregado: "Entregado", cancelado: "Cancelado",
};
const NEXT: Record<string, { to: string; text: string } | undefined> = {
  nuevo: { to: "confirmado", text: "Confirmar" },
  confirmado: { to: "en_ruta", text: "Enviar" },
  en_ruta: { to: "entregado", text: "Entregado" },
};

type O = {
  id: number; status: string; total_crc: number; paid: boolean; created_at: string; channel: string;
  customers: { name: string } | null;
};

export default async function Pedidos({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const [cus, zon, prod, ord] = await Promise.all([
    supabase.from("customers").select("id, name").order("name").limit(500),
    supabase.from("delivery_zones").select("id, name").order("name"),
    supabase.from("products").select("id, name, size_ml, sale_price").eq("active", true).order("name"),
    supabase
      .from("orders")
      .select("id, status, total_crc, paid, created_at, channel, customers(name)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const customers = (cus.data ?? []) as { id: number; name: string }[];
  const zones = (zon.data ?? []) as { id: number; name: string }[];
  const products = (prod.data ?? []) as { id: number; name: string; size_ml: number; sale_price: number | null }[];
  const orders = (ord.data ?? []) as unknown as O[];

  return (
    <>
      <h1 className="font-serif text-3xl">Pedidos</h1>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Listo.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}

      <form action={createOrder} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
        <div>
          <p className={label}>Cliente</p>
          <select name="customer_id" className={input} defaultValue="">
            <option value="">— sin cliente —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <p className={label}>Zona de entrega</p>
          <select name="zone_id" className={input} defaultValue="">
            <option value="">— sin envío —</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={label}>Canal</p>
            <select name="channel" className={input} defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="manual">Manual</option>
              <option value="web">Web</option>
            </select>
          </div>
          <div>
            <p className={label}>Pago</p>
            <select name="payment_method" className={input} defaultValue="sinpe">
              <option value="sinpe">SINPE</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 sm:col-span-3">
          <p className={label}>Productos (el precio lo toma el sistema)</p>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem] gap-2">
              <select name={`product_${i}`} className={input} defaultValue="">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.size_ml} ml{p.sale_price ? ` · ${colones(p.sale_price)}` : " · sin precio"}
                  </option>
                ))}
              </select>
              <input name={`qty_${i}`} inputMode="numeric" placeholder="Cant." className={input} />
            </div>
          ))}
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit">
          Crear pedido
        </button>
      </form>

      <ul className="mt-6 divide-y divide-rule">
        {orders.length === 0 && <li className="py-4 text-ink-muted">Aún no hay pedidos.</li>}
        {orders.map((o) => {
          const next = NEXT[o.status];
          const open = o.status !== "entregado" && o.status !== "cancelado";
          return (
            <li key={o.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-lg">
                  #{o.id} · {o.customers?.name ?? "Sin cliente"}
                </p>
                <p className="font-mono text-lg">{colones(o.total_crc)}</p>
              </div>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                <span className={o.status === "nuevo" ? "text-alarm" : ""}>{STATUS[o.status] ?? o.status}</span>
                {" · "}{o.paid ? "Pagado" : "Sin pagar"}{" · "}{o.channel}{" · "}
                {new Date(o.created_at).toLocaleDateString("es-CR")}
              </p>
              {open && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {next && (
                    <form action={changeStatus} className="flex items-center gap-3">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value={next.to} />
                      {next.to === "entregado" && (
                        <label className="flex items-center gap-2 text-xs text-ink-muted">
                          <input type="checkbox" name="age_ok" /> Verifiqué que es mayor de 18
                        </label>
                      )}
                      <button className="rounded-full border border-ink-muted px-4 py-1 font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-ink hover:text-background">
                        {next.text}
                      </button>
                    </form>
                  )}
                  {!o.paid && (
                    <form action={markPaid}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <button className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink">Marcar pagado</button>
                    </form>
                  )}
                  <form action={changeStatus}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="status" value="cancelado" />
                    <button className="font-mono text-[11px] uppercase tracking-[0.18em] text-alarm">Cancelar</button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
