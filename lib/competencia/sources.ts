// [LA14 · COMPETENCIA · v2] lib/competencia/sources.ts
// Fuentes que La 14 consulta. Para agregar una tienda: copia un bloque,
// pon su dirección y la lista de "métodos" (adapters) a probar, en orden.
//
//  vtex        tiendas hechas con VTEX (Walmart, Masxmenos, Maxi Palí...). URL de producto termina en /p
//  shopify     tiendas Shopify (URL de producto con /products/...)
//  woocommerce tiendas WordPress + WooCommerce (URL con /producto/ o /product/)
//  jsonld      cualquier tienda que publique datos estructurados (schema.org) en su página de búsqueda;
//              {q} se reemplaza por lo que escribas.
//
// Si una tienda no tiene dirección (baseUrl: null) aparece como "Por configurar".

export type Adapter =
  | { kind: "vtex" }
  | { kind: "shopify" }
  | { kind: "woocommerce" }
  | { kind: "jsonld"; searchPath: string }
  | { kind: "megasuper" };

export type Source = {
  slug: string;
  name: string;
  baseUrl: string | null;
  adapters: Adapter[];
};

const VTEX_PAGE: Adapter = { kind: "jsonld", searchPath: "/{q}?_q={q}&map=ft" };

export const SOURCES: Source[] = [
  {
    slug: "habla-bebidas",
    name: "Habla Bebidas",
    baseUrl: "https://hablabebidas.interfuerza.shop",
    adapters: [{ kind: "shopify" }, { kind: "woocommerce" }, { kind: "jsonld", searchPath: "/?s={q}&post_type=product" }],
  },
  {
    slug: "mini-super-zeus",
    name: "Mini Súper Zeus",
    baseUrl: "https://www.minisuperzeus.com",
    adapters: [{ kind: "shopify" }, { kind: "woocommerce" }, { kind: "jsonld", searchPath: "/?s={q}&post_type=product" }],
  },
  {
  slug: "mega-super",
  name: "Mega Súper",
  baseUrl: "https://www.megasuper.com",
  adapters: [
      { kind: "megasuper" }
    ],
  },
  {
    slug: "vinum",
    name: "Vinum",
    baseUrl: "https://www.vinumcr.com",
    adapters: [{ kind: "shopify" }, { kind: "woocommerce" }, { kind: "jsonld", searchPath: "/?s={q}&post_type=product" }],
  },
  {
    slug: "pricesmart",
    name: "PriceSmart",
    baseUrl: "https://www.pricesmart.com", // por verificar; puede exigir cuenta de socio
    adapters: [{ kind: "jsonld", searchPath: "/es-cr/search?q={q}" }],
  },
  {
    slug: "walmart",
    name: "Walmart",
    baseUrl: "https://www.walmart.co.cr",
    adapters: [{ kind: "vtex" }, VTEX_PAGE],
  },
];
