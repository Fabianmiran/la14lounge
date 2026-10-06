// [LA14 · DASHBOARD · v1] app/admin/page.tsx (reemplaza al de BASE v1)
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";

const THRESHOLD = 10; // margen mínimo (%) por debajo del cual se marca en rojo

type Prod = { id: number; name: string; size_ml: number; sale_price: number | null; min_stock: number };
type Ov = { id: number; margin_pct: number | null };
type Ord = { status: string; total_crc: number; paid: boolean; created_at: string; delivered_at: string | null };
type Sold = { product_id: number; qty: number };
type Bubble = { id: number; name: string; m: number; units: number; r: number; x: number; y: number };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-5 text-center sm:px-6">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{label}</div>
      <div className="mt-2 font-mono text-3xl leading-none tracking-tight sm:text-[40px]">{value}</div>
    </div>
  );
}

// Reparte las burbujas sin que se encimen (misma idea del gráfico de la plantilla).
function layout(items: { id: number; name: string; m: number; units: number }[], W: number, domain: [number, number]) {
  const padX = 34;
  const sx = (m: number) => padX + ((m - domain[0]) / (domain[1] - domain[0])) * (W - padX * 2);
  const placed: Bubble[] = [];
  for (const it of [...items].sort((a, b) => a.m - b.m)) {
    const r = Math.min(24, 7 + Math.sqrt(it.units) * 3);
    const x = sx(it.m);
    let y = 0;
    for (let k = 0; k < 400; k++) {
      y = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 1.5)) break;
    }
    placed.push({ ...it, r, x, y });
  }
  return { placed, sx };
}

export default async function Dashboard() {
  const supabase = await createClient();

  const [prod, ov, stk, ord, sold] = await Promise.all([
    supabase.from("products").select("id, name, size_ml, sale_price, min_stock").eq("active", true),
    supabase.from("v_pricing_overview").select("id, margin_pct"),
    supabase.from("v_stock").select("product_id, stock"),
    supabase.from("orders").select("status, total_crc, paid, created_at, delivered_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("order_items").select("product_id, qty, orders!inner(status)").eq("orders.status", "entregado").limit(5000),
  ]);

  const products = (prod.data ?? []) as Prod[];
  const margin = new Map(((ov.data ?? []) as Ov[]).map((o) => [o.id, o.margin_pct]));
  const stock = new Map(((stk.data ?? []) as { product_id: number; stock: number }[]).map((s) => [s.product_id, s.stock]));
  const orders = (ord.data ?? []) as Ord[];
  const units = new Map<number, number>();
  for (const s of (sold.data ?? []) as unknown as Sold[]) units.set(s.product_id, (units.get(s.product_id) ?? 0) + s.qty);

  // Cifras principales
  const now = new Date();
  const monthSales = orders
    .filter((o) => {
      const d = new Date(o.delivered_at ?? o.created_at);
      return o.status === "entregado" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, o) => s + o.total_crc, 0);
  const open = orders.filter((o) => ["nuevo", "confirmado", "en_ruta"].includes(o.status)).length;
  const toCollect = orders.filter((o) => !o.paid && o.status !== "cancelado").reduce((s, o) => s + o.total_crc, 0);

  const isLow = (p: Prod) => {
    const s = stock.get(p.id) ?? 0;
    return s <= 0 || (p.min_stock > 0 && s <= p.min_stock);
  };
  const lowCount = products.filter(isLow).length;

  // Gráfico de burbujas: margen (horizontal) y unidades vendidas (tamaño)
  const withMargin = products.flatMap((p) => {
    const m = margin.get(p.id);
    return m === null || m === undefined ? [] : [{ id: p.id, name: p.name, m: Number(m), units: units.get(p.id) ?? 0 }];
  });
  const lo = Math.min(0, Math.floor(Math.min(...withMargin.map((b) => b.m), 0) / 10) * 10);
  const hi = Math.max(40, Math.ceil(Math.max(...withMargin.map((b) => b.m), 0) / 10) * 10);
  const W = 800;
  const { placed, sx } = layout(withMargin, W, [lo, hi]);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 10) ticks.push(t);

  // Lista de revisión
  const watch = products
    .map((p) => {
      const m = margin.get(p.id);
      const reasons = [
        m !== null && m !== undefined && Number(m) < THRESHOLD ? "Margen bajo" : null,
        isLow(p) ? ((stock.get(p.id) ?? 0) <= 0 ? "Agotado" : "Stock bajo") : null,
        !p.sale_price ? "Sin precio de venta" : null,
      ].filter(Boolean) as string[];
      return { p, m, reasons };
    })
    .filter((w) => w.reasons.length > 0);

  return (
    <>
      <h1 className="font-serif text-3xl">Resumen</h1>

      <section className="mt-4 grid grid-cols-2 divide-x divide-rule border-y-2 border-ink-muted sm:grid-cols-4">
        <Stat label="Ventas del mes" value={colones(monthSales)} />
        <Stat label="Pedidos abiertos" value={String(open)} />
        <Stat label="Por cobrar" value={colones(toCollect)} />
        <Stat label="Stock bajo" value={String(lowCount)} />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Margen por producto</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Cada burbuja es un producto: más a la derecha, más margen; más grande, más unidades vendidas. En rojo, bajo el {THRESHOLD}%.
        </p>
        {withMargin.length === 0 ? (
          <p className="mt-4 text-ink-muted">
            Aún no hay márgenes. Se calculan al registrar el costo de un producto (Proveedores → Precios y comparador) y tener precio de venta.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} 250`} className="mt-4 w-full" role="img" aria-label="Gráfico de margen por producto">
            <line x1={sx(THRESHOLD)} x2={sx(THRESHOLD)} y1="14" y2="205" stroke="var(--ink-faint)" strokeWidth="1" />
            <text x={sx(THRESHOLD) + 6} y="22" className="font-mono" fontSize="10" fill="var(--ink-faint)" letterSpacing="1.5">MARGEN MÍNIMO</text>
            {placed.map((b) => (
              <circle key={b.id} cx={b.x} cy={110 + b.y} r={b.r}
                fill={b.m < THRESHOLD ? "var(--alarm)" : "var(--ink-muted)"} fillOpacity={b.m < THRESHOLD ? 0.9 : 0.75}>
                <title>{`${b.name} · margen ${b.m}% · ${b.units} vendidas`}</title>
              </circle>
            ))}
            {ticks.map((t) => (
              <text key={t} x={sx(t)} y="232" textAnchor="middle" className="font-mono" fontSize="11" fill="var(--ink-faint)">{t}%</text>
            ))}
          </svg>
        )}
      </section>

      <section className="mt-10 bg-surface p-6">
        <h2 className="font-serif text-2xl">Para revisar</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              <tr className="border-b border-rule">
                <th className="py-2 font-normal">Producto</th>
                <th className="text-right font-normal">Precio</th>
                <th className="text-right font-normal">Margen</th>
                <th className="text-right font-normal">Stock</th>
                <th className="text-right font-normal">Vendidas</th>
                <th className="pl-6 font-normal">Motivo</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {watch.map(({ p, m, reasons }) => (
                <tr key={p.id} className="border-b border-rule">
                  <td className="py-3 font-sans">{p.name} <span className="text-ink-faint">{p.size_ml} ml</span></td>
                  <td className="text-right">{p.sale_price ? colones(p.sale_price) : "—"}</td>
                  <td className={`text-right ${m !== null && m !== undefined && Number(m) < THRESHOLD ? "text-alarm" : ""}`}>
                    {m !== null && m !== undefined ? `${m}%` : "—"}
                  </td>
                  <td className={`text-right ${isLow(p) ? "text-alarm" : ""}`}>{stock.get(p.id) ?? 0}</td>
                  <td className="text-right">{units.get(p.id) ?? 0}</td>
                  <td className="pl-6 font-sans text-xs text-alarm">{reasons.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          {watch.length === 0 ? "Todo en orden: ningún producto necesita atención." : "Un guion (—) significa que el dato aún no existe, no que sea cero."}
        </p>
      </section>
    </>
  );
}
