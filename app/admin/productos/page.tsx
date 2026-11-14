// [LA14 · PRODUCTOS · v1] app/admin/productos/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SAFE_SLUG } from "@/lib/productos";
import { createCategory, createProduct, saveProducts } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const ERRORS: Record<string, string> = {
  vacio: "No hay productos para guardar.",
  datos: "Revisa los datos: nombre, categoría, presentación (50–5000 ml) y precio válidos.",
  existe: "Ya existe un producto con ese nombre y presentación.",
  catexiste: "Esa categoría ya existe o el nombre no es válido.",
  guardar: "No se pudo guardar. Intenta de nuevo.",
};

type P = {
  id: number; name: string; brand: string | null; size_ml: number; sale_price: number | null;
  active: boolean; min_stock: number; category_id: number | null;
};
type Cat = { id: number; name: string; slug: string };

export default async function Productos({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; g?: string; e?: string; b?: string; nuevo?: string; c?: string; v?: string; crear?: string }>;
}) {
  const sp = await searchParams;
  const slug = SAFE_SLUG.test(sp.c ?? "") ? (sp.c ?? "") : "";
  const pendientes = sp.v === "pendientes";
  const supabase = await createClient();

  const [cr, pr, st] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase.from("products").select("id, name, brand, size_ml, sale_price, active, min_stock, category_id").order("name").limit(500),
    supabase.from("v_stock_status").select("product_id, on_hand, reserved, available"),
  ]);
  const cats = (cr.data ?? []) as Cat[];
  const all = (pr.data ?? []) as P[];
  const stock = new Map(
    ((st.data ?? []) as { product_id: number; on_hand: number; reserved: number; available: number }[]).map((s) => [s.product_id, s]),
  );

  const cat = cats.find((c) => c.slug === slug);
  const inCat = cat ? all.filter((p) => p.category_id === cat.id) : all;
  const rows = pendientes ? inCat.filter((p) => !p.active || p.sale_price === null) : inCat;
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const countFor = (id: number) => all.filter((p) => p.category_id === id).length;
  const href = (c: string, v?: string) => `/admin/productos?${[c && `c=${c}`, v && `v=${v}`].filter(Boolean).join("&")}`;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl">Productos</h1>
        <div className="flex gap-2">
          <Link href={`${href(slug, pendientes ? "pendientes" : "")}${slug || pendientes ? "&" : "?"}crear=producto`}
            className="rounded-full bg-ink px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">+ Producto</Link>
          <Link href={`${href(slug, pendientes ? "pendientes" : "")}${slug || pendientes ? "&" : "?"}crear=categoria`}
            className="rounded-full border border-ink-muted px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-background">+ Categoría</Link>
        </div>
      </div>

      {sp.ok && (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          ✓ Listo.{sp.g ? ` ${sp.g} producto${sp.g === "1" ? "" : "s"} actualizado${sp.g === "1" ? "" : "s"}` : ""}
          {sp.b && sp.b !== "0" ? `, ${sp.b} botella${sp.b === "1" ? "" : "s"} cargada${sp.b === "1" ? "" : "s"} al inventario` : ""}
          {sp.g ? "." : ""}
        </p>
      )}
      {sp.e && sp.e !== "0" && (
        <p className="mt-2 font-mono text-xs text-alarm">
          {sp.e} fila{sp.e === "1" ? "" : "s"} no se guardó{sp.e === "1" ? "" : "ron"}: revisa que el precio sea un número mayor a 0 y que no actives un producto sin precio.
        </p>
      )}
      {sp.error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[sp.error] ?? "Ocurrió un error."}</p>}

      {sp.crear === "producto" && (
        <form action={createProduct} className="mt-5 grid gap-3 border-y border-rule py-5 sm:grid-cols-4">
          <input type="hidden" name="back_c" value={slug} />
          <input type="hidden" name="back_v" value={pendientes ? "pendientes" : ""} />
          <div className="sm:col-span-2"><p className={label}>Nombre *</p><input name="name" required maxLength={120} className={input} placeholder="Ej. Flor de Caña 18 Años" /></div>
          <div><p className={label}>Marca</p><input name="brand" maxLength={60} className={input} /></div>
          <div>
            <p className={label}>Categoría *</p>
            <select name="category_id" required className={input} defaultValue={cat?.id ?? ""}>
              <option value="" disabled>Elegir…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><p className={label}>Presentación (ml) *</p><input name="size_ml" required inputMode="numeric" className={input} defaultValue="750" /></div>
          <div><p className={label}>Grado alcohólico %</p><input name="abv" inputMode="decimal" className={input} /></div>
          <div><p className={label}>Precio ₡ (opcional)</p><input name="price" inputMode="numeric" className={input} /></div>
          <div className="flex items-end"><button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">Crear</button></div>
          <p className="text-xs text-ink-faint sm:col-span-4">Nace inactivo. Actívalo en la lista cuando tenga precio.</p>
        </form>
      )}
      {sp.crear === "categoria" && (
        <form action={createCategory} className="mt-5 flex flex-wrap items-end gap-3 border-y border-rule py-5">
          <input type="hidden" name="back_c" value={slug} />
          <input type="hidden" name="back_v" value={pendientes ? "pendientes" : ""} />
          <div className="w-64"><p className={label}>Nombre de la categoría *</p><input name="cat_name" required maxLength={40} className={input} placeholder="Ej. Mezcal" /></div>
          <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">Crear</button>
        </form>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        <Link href={href("", pendientes ? "pendientes" : "")}
          className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] ${!cat ? "border-ink bg-ink text-background" : "border-rule text-ink-muted hover:text-ink"}`}>
          Todas · {all.length}
        </Link>
        {cats.filter((c) => countFor(c.id) > 0).map((c) => (
          <Link key={c.id} href={href(c.slug, pendientes ? "pendientes" : "")}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] ${cat?.id === c.id ? "border-ink bg-ink text-background" : "border-rule text-ink-muted hover:text-ink"}`}>
            {c.name} · {countFor(c.id)}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-ink-muted">
        <Link href={href(slug, pendientes ? "" : "pendientes")} className="underline hover:text-ink">
          {pendientes ? "Ver todos" : `Ver solo pendientes (sin precio o inactivos): ${inCat.filter((p) => !p.active || p.sale_price === null).length}`}
        </Link>
      </p>

      <form action={saveProducts} className="mt-4">
        <input type="hidden" name="back_c" value={slug} />
        <input type="hidden" name="back_v" value={pendientes ? "pendientes" : ""} />
        {rows.map((p) => <input key={p.id} type="hidden" name="ids" value={p.id} />)}

        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-background py-3">
          <p className="text-xs text-ink-faint">Edita lo que necesites y guarda todo de una vez ({rows.length} en pantalla).</p>
          <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90">Guardar cambios</button>
        </div>

        <ul className="divide-y divide-rule">
          {rows.length === 0 && <li className="py-6 text-ink-muted">Nada por aquí.</li>}
          {rows.map((p) => {
            const s = stock.get(p.id) ?? { on_hand: 0, reserved: 0, available: 0 };
            return (
              <li key={p.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_7rem_5rem_6rem_4.5rem] sm:items-end">
                <div>
                  <p className="font-serif text-lg">{p.name} <span className="font-sans text-xs text-ink-faint">{p.size_ml} ml</span></p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    {catName.get(p.category_id ?? -1) ?? "Sin categoría"}{p.brand ? ` · ${p.brand}` : ""} · disponible {s.available} (físico {s.on_hand}, reservado {s.reserved})
                  </p>
                </div>
                <div><p className={label}>Precio ₡</p>
                  <input name={`price_${p.id}`} inputMode="numeric" defaultValue={p.sale_price ?? ""} placeholder="—" className={input} /></div>
                <div><p className={label}>Mín.</p>
                  <input name={`min_${p.id}`} inputMode="numeric" defaultValue={p.min_stock} className={input} /></div>
                <div><p className={label}>+ Stock</p>
                  <input name={`add_${p.id}`} inputMode="numeric" placeholder="0" className={input} /></div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name={`active_${p.id}`} defaultChecked={p.active} /> Activo
                </label>
              </li>
            );
          })}
        </ul>
      </form>
    </>
  );
}
