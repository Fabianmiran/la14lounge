import { supabase } from "@/lib/supabase";

// La página se refresca sola cada 60 segundos con los datos de la base.
export const revalidate = 60;

type Product = {
  id: number;
  name: string;
  brand: string | null;
  size_ml: number;
  abv: number | null;
  sale_price: number | null;
  categories: { name: string } | null;
};

const colones = (n: number) => "₡" + n.toLocaleString("es-CR");

export default async function Home() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, size_ml, abv, sale_price, categories(name)")
    .eq("active", true)
    .order("name");

  const products = (data ?? []) as unknown as Product[];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-8 text-center">
        <h1 className="text-4xl font-bold tracking-wide text-amber-400">
          La 14 Lounge
        </h1>
        <p className="mt-2 text-neutral-400">
          Licores con entrega en el Gran Área Metropolitana
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Venta exclusiva a mayores de 18 años
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {error && (
          <p className="text-red-400">
            No pudimos cargar el catálogo. Intenta de nuevo en un momento.
          </p>
        )}

        {!error && products.length === 0 && (
          <p className="text-neutral-400">Pronto tendremos productos aquí.</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
            >
              <p className="text-xs uppercase tracking-wider text-amber-500">
                {p.categories?.name}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{p.name}</h2>
              <p className="text-sm text-neutral-400">
                {p.size_ml} ml{p.abv ? ` · ${p.abv}% alc.` : ""}
              </p>
              <p className="mt-4 text-xl font-bold">
                {p.sale_price ? colones(p.sale_price) : "Consultar"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
