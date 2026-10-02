import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { Marquee } from "@/components/Marquee";
import { AddToCart } from "@/components/AddToCart";

type P = {
  id: number; name: string; brand: string | null; size_ml: number;
  sale_price: number | null; compare_at_price: number | null;
  categories: { name: string } | null;
};
const colones = (n: number) => "₡" + n.toLocaleString("es-CR");

function Card({ p }: { p: P }) {
  const offer = p.sale_price && p.compare_at_price && p.compare_at_price > p.sale_price;
  return (
    <li className="flex flex-col border border-rule bg-surface p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{p.categories?.name}</p>
      <h3 className="mt-1 font-serif text-xl">{p.name}</h3>
      <p className="font-mono text-xs text-ink-muted">{p.size_ml} ml</p>
      <div className="mt-auto flex items-end justify-between pt-5">
        <div>
          {offer && <p className="font-mono text-xs text-ink-faint line-through">{colones(p.compare_at_price!)}</p>}
          <p className={`font-mono text-lg ${offer ? "text-alarm" : ""}`}>{p.sale_price ? colones(p.sale_price) : "Consultar"}</p>
        </div>
        {p.sale_price ? <AddToCart id={p.id} name={p.name} price={p.sale_price} /> : null}
      </div>
    </li>
  );
}

export default async function Home() {
  const { data } = await supabase
    .from("products")
    .select("id, name, brand, size_ml, sale_price, compare_at_price, is_featured, categories(name)")
    .eq("active", true).order("name");
  const all = (data ?? []) as unknown as (P & { is_featured: boolean })[];
  const offers = all.filter((p) => p.sale_price && p.compare_at_price && p.compare_at_price > p.sale_price);
  const featured = all.filter((p) => p.is_featured).slice(0, 8);

  return (
    <>
      <SiteHeader />
      <main>
        <h1 className="sr-only">La 14 Lounge: licores con entrega en el GAM</h1>
        <Marquee text="Selección curada" />
        <Marquee text="Entrega en el GAM" reverse />
        <Marquee text="Pedí por WhatsApp" />

        {offers.length > 0 && (
          <section className="mx-auto max-w-5xl px-6 py-14">
            <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">Por tiempo limitado</p>
            <h2 className="mb-8 text-center font-serif text-4xl">Ofertas</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{offers.map((p) => <Card key={p.id} p={p} />)}</ul>
          </section>
        )}

        <section className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">Favoritos</p>
          <h2 className="mb-8 text-center font-serif text-4xl">Destacados</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((p) => <Card key={p.id} p={p} />)}</ul>
          <p className="mt-10 text-center">
            <Link href="/catalogo" className="text-sm underline-offset-4 hover:underline">Ver el catálogo completo →</Link>
          </p>
        </section>
      </main>
      <footer className="border-t border-rule px-6 py-10 text-center text-xs text-ink-faint">
        <p className="font-serif text-lg text-ink">La 14 Lounge</p>
        <p className="mt-2">Venta exclusiva a mayores de 18 años. Disfruta con moderación.</p>
      </footer>
    </>
  );
}
