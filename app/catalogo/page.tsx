import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { AddToCart } from "@/components/AddToCart";

export const metadata: Metadata = { title: "Catálogo" };

type Category = { id: number; name: string; slug: string };
type Product = {
  id: number;
  name: string;
  brand: string | null;
  size_ml: number;
  abv: number | null;
  sale_price: number | null;
  categories: { name: string; slug: string } | null;
};

const colones = (n: number) => "₡" + n.toLocaleString("es-CR");

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;

  const [catsRes, prodsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase
      .from("products")
      .select("id, name, brand, size_ml, abv, sale_price, categories(name, slug)")
      .eq("active", true)
      .order("name"),
  ]);

  const categories = (catsRes.data ?? []) as Category[];
  const products = (prodsRes.data ?? []) as unknown as Product[];

  // El filtro solo acepta categorías que existen (nunca se confía en la URL).
  const active = categories.find((c) => c.slug === cat)?.slug ?? null;
  const shown = active
    ? products.filter((p) => p.categories?.slug === active)
    : products;

  return (
    <>
      <SiteHeader />
      <main className="page-rise mx-auto max-w-5xl px-6 pb-16 pt-12">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Catálogo</h1>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href="/catalogo"
            className={active ? "text-ink-faint hover:text-ink" : "text-ink"}
          >
            Todos
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalogo?cat=${c.slug}`}
              className={
                active === c.slug ? "text-ink" : "text-ink-faint hover:text-ink"
              }
            >
              {c.name}
            </Link>
          ))}
        </nav>

        {prodsRes.error && (
          <p className="mt-8 text-alarm">
            No pudimos cargar el catálogo. Intenta de nuevo en un momento.
          </p>
        )}

        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {shown.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-4"
            >
              <div>
                <h2 className="font-serif text-xl">{p.name}</h2>
                <p className="font-mono text-xs text-ink-muted">
                  {p.categories?.name} · {p.size_ml} ml
                  {p.abv ? ` · ${p.abv}%` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-lg">
                  {p.sale_price ? colones(p.sale_price) : "Consultar"}
                </p>
                {p.sale_price ? (
                  <AddToCart id={p.id} name={p.name} price={p.sale_price} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {!prodsRes.error && shown.length === 0 && (
          <p className="mt-8 text-ink-muted">Pronto tendremos productos aquí.</p>
        )}
      </main>
      <footer className="border-t border-rule px-6 py-10 text-center text-xs text-ink-faint">
        Venta exclusiva a mayores de 18 años. Disfruta con moderación.
      </footer>
    </>
  );
}
