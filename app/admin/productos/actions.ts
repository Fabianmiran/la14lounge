// [LA14 · PRODUCTOS · v1] app/admin/productos/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { int, txt } from "@/lib/forms";
import { SAFE_SLUG, parseCantidad, parseGrado, parsePrecio, slugify } from "@/lib/productos";

const BASE = "/admin/productos";
const back = (f: FormData) => {
  const c = String(f.get("back_c") ?? "");
  const v = String(f.get("back_v") ?? "");
  const q = new URLSearchParams();
  if (SAFE_SLUG.test(c) && c) q.set("c", c);
  if (v === "pendientes") q.set("v", v);
  return q.toString() ? `${BASE}?${q}` : BASE;
};
const withMsg = (url: string, extra: string) => url + (url.includes("?") ? "&" : "?") + extra;

// Guarda de una vez todo lo que se editó en la lista: precio, activo, stock mínimo y entrada de stock.
export async function saveProducts(formData: FormData) {
  const supabase = await requireAdmin();
  const url = back(formData);

  const ids = [...new Set(formData.getAll("ids").map((x) => Number(String(x))))]
    .filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 300);
  if (ids.length === 0) redirect(withMsg(url, "error=vacio"));

  const { data: current } = await supabase.from("products").select("id, sale_price, active, min_stock").in("id", ids);
  const byId = new Map((current ?? []).map((p) => [p.id as number, p as { id: number; sale_price: number | null; active: boolean; min_stock: number }]));

  let guardados = 0, errores = 0, botellas = 0;
  for (const id of ids) {
    const cur = byId.get(id);
    if (!cur) { errores++; continue; }

    const price = parsePrecio(formData.get(`price_${id}`));
    const min = parseCantidad(formData.get(`min_${id}`));
    const add = parseCantidad(formData.get(`add_${id}`));
    const active = formData.get(`active_${id}`) === "on";
    if (price === "invalido" || min === null || add === null || (active && price === null)) { errores++; continue; }

    const patch: { sale_price?: number | null; active?: boolean; min_stock?: number } = {};
    if (price !== cur.sale_price) patch.sale_price = price;
    if (active !== cur.active) patch.active = active;
    if (min !== cur.min_stock) patch.min_stock = min;

    let changed = false;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) { errores++; continue; }
      changed = true;
    }
    if (add > 0) {
      const { error } = await supabase.rpc("register_stock", {
        p_product: id, p_qty: add, p_reason: "compra", p_note: "Carga desde Productos",
      });
      if (error) { errores++; continue; }
      botellas += add; changed = true;
    }
    if (changed) guardados++;
  }

  revalidatePath(BASE);
  revalidatePath("/admin/inventario");
  revalidatePath("/");
  redirect(withMsg(url, `ok=1&g=${guardados}&e=${errores}&b=${botellas}`));
}

export async function createProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const url = back(formData);

  const name = txt(formData, "name", 120);
  const brand = txt(formData, "brand", 60);
  const category = int(formData, "category_id");
  const size = int(formData, "size_ml");
  const abv = parseGrado(formData.get("abv"));
  const price = parsePrecio(formData.get("price"));
  if (!name || !category || !size || size < 50 || size > 5000 || abv === "invalido" || price === "invalido")
    redirect(withMsg(url, "error=datos"));

  const { data: dup } = await supabase.from("products").select("id").eq("name", name).eq("size_ml", size).limit(1);
  if (dup && dup.length > 0) redirect(withMsg(url, "error=existe"));

  // Nace inactivo: se activa en la lista cuando el precio esté listo.
  const { error } = await supabase.from("products").insert({
    name, brand, category_id: category, size_ml: size, abv, sale_price: price, active: false,
  });
  if (error) redirect(withMsg(url, "error=guardar"));

  revalidatePath(BASE);
  redirect(withMsg(url, "ok=1&nuevo=1"));
}

export async function createCategory(formData: FormData) {
  const supabase = await requireAdmin();
  const url = back(formData);

  const name = txt(formData, "cat_name", 40);
  const slug = name ? slugify(name) : "";
  if (!name || !slug) redirect(withMsg(url, "error=datos"));

  const { error } = await supabase.from("categories").insert({ name, slug });
  if (error) redirect(withMsg(url, "error=catexiste"));

  revalidatePath(BASE);
  redirect(withMsg(url, "ok=1&nuevo=1"));
}
