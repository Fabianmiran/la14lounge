// [LA14 · INVENTARIO · v1] app/admin/inventario/page.tsx
import { createClient } from "@/lib/supabase/server";
import { registerStock, setMinStock } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const MOTIVO: Record<string, string> = { compra: "Entrada", venta: "Venta", merma: "Merma", ajuste: "Ajuste" };

type P = { id: number; name: string; size_ml: number; min_stock: number };
type M = { qty: number; reason: string; note: string | null; created_at: string; products: { name: string } | null };

export default async function Inventario({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const [prod, stk, mov] = await Promise.all([
    supabase.from("products").select("id, name, size_ml, min_stock").order("name"),
    supabase.from("v_stock").select("product_id, stock"),
    supabase
      .from("stock_movements")
      .select("qty, reason, note, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const products = (prod.data ?? []) as P[];
  const stock = new Map(((stk.data ?? []) as { product_id: number; stock: number }[]).map((s) => [s.product_id, s.stock]));
  const moves = (mov.data ?? []) as unknown as M[];

  return (
    <>
      <h1 className="font-serif text-3xl">Inventario</h1>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Guardado.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">Revisa los datos e intenta de nuevo.</p>}

      <form action={registerStock} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className={label}>Producto *</p>
          <select name="product_id" required className={input} defaultValue="">
            <option value="" disabled>Elegir…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.size_ml} ml</option>)}
          </select>
        </div>
        <div>
          <p className={label}>Movimiento *</p>
          <select name="tipo" className={input} defaultValue="compra">
            <option value="compra">Entrada (compra)</option>
            <option value="merma">Merma (rotura, vencido)</option>
            <option value="ajuste+">Ajuste: sumar</option>
            <option value="ajuste-">Ajuste: restar</option>
          </select>
        </div>
        <div>
          <p className={label}>Cantidad *</p>
          <input name="qty" required inputMode="numeric" className={input} />
        </div>
        <div className="sm:col-span-4">
          <p className={label}>Nota (opcional)</p>
          <input name="note" maxLength={200} className={input} />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-4 sm:w-fit">
          Registrar movimiento
        </button>
      </form>

      <h2 className="mt-8 font-serif text-2xl">Existencias</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Al marcar un pedido como Entregado, las unidades se restan solas. El stock mínimo activa la alerta.
      </p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {products.length === 0 && <li className="py-4 text-ink-muted">Aún no hay productos.</li>}
        {products.map((p) => {
          const s = stock.get(p.id) ?? 0;
          const low = s <= 0 || (p.min_stock > 0 && s <= p.min_stock);
          return (
            <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
              <div>
                <p className="font-serif text-lg">{p.name} <span className="font-sans text-xs text-ink-faint">{p.size_ml} ml</span></p>
                <form action={setMinStock} className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                  <input type="hidden" name="product_id" value={p.id} />
                  Stock mínimo
                  <input name="min_stock" inputMode="numeric" defaultValue={p.min_stock} className="w-16 border border-rule bg-background p-1 text-center font-mono" />
                  <button className="hover:text-ink">Guardar</button>
                </form>
              </div>
              <p className={`text-right font-mono text-3xl ${low ? "text-alarm" : ""}`}>
                {s}
                {low && <span className="block text-[10px] uppercase tracking-[0.18em]">{s <= 0 ? "Agotado" : "Stock bajo"}</span>}
              </p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 font-serif text-2xl">Últimos movimientos</h2>
      <ul className="mt-3 divide-y divide-rule">
        {moves.length === 0 && <li className="py-3 text-ink-muted">Sin movimientos todavía.</li>}
        {moves.map((m, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-4 py-2 text-sm">
            <p>
              {m.products?.name ?? "—"}{" "}
              <span className="text-xs text-ink-faint">· {MOTIVO[m.reason] ?? m.reason}{m.note ? ` · ${m.note}` : ""}</span>
            </p>
            <p className={`font-mono ${m.qty < 0 ? "text-ink-muted" : ""}`}>
              {m.qty > 0 ? "+" : ""}{m.qty} <span className="text-xs text-ink-faint">{new Date(m.created_at).toLocaleDateString("es-CR")}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
