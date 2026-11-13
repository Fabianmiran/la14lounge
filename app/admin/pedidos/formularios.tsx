// [LA14 · PEDIDOS · v1] app/admin/pedidos/formularios.tsx
// Formularios de "Nuevo": cotizar o pedido directo. Son componentes de servidor (sin JavaScript en el navegador).
import { colones } from "@/lib/forms";
import { createOrder } from "./actions";
import { createQuote } from "./cotizaciones/actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const btn = "rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-3 sm:w-fit";

export type Opt = { id: number; name: string };
export type Prod = { id: number; name: string; size_ml: number; sale_price: number | null };

function ProductOptions({ products, available }: { products: Prod[]; available: Map<number, number> }) {
  return (
    <>
      <option value="">—</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {p.size_ml} ml · {p.sale_price ? colones(p.sale_price) : "sin precio"} · disp. {available.get(p.id) ?? 0}
        </option>
      ))}
    </>
  );
}

export function FormPedido({ customers, zones, products, available }: {
  customers: Opt[]; zones: Opt[]; products: Prod[]; available: Map<number, number>;
}) {
  return (
    <form action={createOrder} className="grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
      <p className="text-xs text-ink-muted sm:col-span-3">
        Pedido directo (el cliente ya confirmó). Reserva las botellas de inmediato; si no alcanza el stock, no se crea.
      </p>
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
            <option value="whatsapp">WhatsApp</option><option value="manual">Manual</option><option value="web">Web</option>
          </select>
        </div>
        <div>
          <p className={label}>Pago</p>
          <select name="payment_method" className={input} defaultValue="sinpe">
            <option value="sinpe">SINPE</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>
      <div className="space-y-2 sm:col-span-3">
        <p className={label}>Productos (el precio lo toma el sistema)</p>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem] gap-2">
            <select name={`product_${i}`} className={input} defaultValue=""><ProductOptions products={products} available={available} /></select>
            <input name={`qty_${i}`} inputMode="numeric" placeholder="Cant." className={input} />
          </div>
        ))}
      </div>
      <button className={btn}>Crear pedido</button>
    </form>
  );
}

export function FormCotizacion({ customers, zones, products, available }: {
  customers: Opt[]; zones: Opt[]; products: Prod[]; available: Map<number, number>;
}) {
  const priced = products.filter((p) => p.sale_price);
  return (
    <form action={createQuote} className="grid gap-4 border-y border-rule py-6 sm:grid-cols-3">
      <p className="text-xs text-ink-muted sm:col-span-3">
        Cotizar no reserva botellas: el stock se aparta cuando el cliente acepta.
      </p>
      <div>
        <p className={label}>Cliente registrado</p>
        <select name="customer_id" className={input} defaultValue="">
          <option value="">— otro / sin registrar —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <p className={label}>…o nombre (si no está registrado)</p>
        <input name="customer_name" maxLength={120} className={input} placeholder="Ej. Bar El Faro" />
      </div>
      <div>
        <p className={label}>Zona de entrega</p>
        <select name="zone_id" className={input} defaultValue="">
          <option value="">— sin envío —</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>
      <div className="space-y-2 sm:col-span-3">
        <p className={label}>Productos (precio automático · descuento en % por línea)</p>
        {Array.from({ length: 10 }, (_, k) => k + 1).map((i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
            <select name={`product_${i}`} className={input} defaultValue=""><ProductOptions products={priced} available={available} /></select>
            <input name={`qty_${i}`} inputMode="numeric" placeholder="Cant." className={input} />
            <input name={`discount_${i}`} inputMode="decimal" placeholder="Desc. %" className={input} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><p className={label}>Vigencia (días)</p><input name="valid_days" inputMode="numeric" defaultValue="7" className={input} /></div>
        <div><p className={label}>Margen mínimo %</p><input name="min_margin" inputMode="decimal" defaultValue="10" className={input} /></div>
      </div>
      <div className="sm:col-span-2">
        <p className={label}>Notas para el cliente (opcional)</p>
        <input name="notes" maxLength={500} className={input} placeholder="Ej. Entrega el viernes por la tarde" />
      </div>
      <button className={btn}>Crear cotización</button>
    </form>
  );
}
