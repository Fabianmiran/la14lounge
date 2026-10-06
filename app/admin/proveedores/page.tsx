// [LA14 · PROVEEDORES · v1] app/admin/proveedores/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { colones } from "@/lib/forms";
import { createSupplier } from "./actions";

const input =
  "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";

const ERRORS: Record<string, string> = {
  nombre: "El nombre del proveedor es obligatorio.",
  correo: "El correo no parece válido.",
  guardar: "No se pudo guardar. Intenta de nuevo.",
};

type Supplier = {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  payment_terms: string | null;
  min_order_crc: number | null;
};

export default async function Proveedores({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, phone, payment_terms, min_order_crc")
    .order("name");
  const suppliers = (data ?? []) as Supplier[];

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Proveedores</h1>
        <Link href="/admin/proveedores/precios" className="text-sm text-ink-muted hover:text-ink">Precios y comparador →</Link>
      </div>

      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Proveedor guardado.</p>}
      {error && (
        <p className="mt-3 font-mono text-xs text-alarm">
          {ERRORS[error] ?? "Ocurrió un error."}
        </p>
      )}

      <form action={createSupplier} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className={label}>Nombre del proveedor *</p>
          <input name="name" required maxLength={120} className={input} />
        </div>
        <div>
          <p className={label}>Contacto</p>
          <input name="contact_name" maxLength={120} className={input} />
        </div>
        <div>
          <p className={label}>Teléfono / WhatsApp</p>
          <input name="phone" maxLength={30} className={input} />
        </div>
        <div>
          <p className={label}>Correo</p>
          <input name="email" type="email" maxLength={254} className={input} />
        </div>
        <div>
          <p className={label}>Condiciones de pago</p>
          <select name="payment_terms" className={input} defaultValue="">
            <option value="">—</option>
            <option>Contado</option>
            <option>8 días</option>
            <option>15 días</option>
            <option>30 días</option>
          </select>
        </div>
        <div>
          <p className={label}>Pedido mínimo (₡)</p>
          <input name="min_order_crc" inputMode="numeric" className={input} />
        </div>
        <div>
          <p className={label}>Notas de entrega</p>
          <input name="delivery_notes" maxLength={500} className={input} />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-2 sm:w-fit">
          Guardar proveedor
        </button>
      </form>

      <ul className="mt-6 divide-y divide-rule">
        {suppliers.length === 0 && (
          <li className="py-4 text-ink-muted">Aún no hay proveedores. Agrega el primero arriba.</li>
        )}
        {suppliers.map((s) => (
          <li key={s.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
            <div>
              <p className="font-serif text-xl">{s.name}</p>
              <p className="text-xs text-ink-faint">
                {[s.contact_name, s.phone].filter(Boolean).join(" · ") || "Sin contacto"}
              </p>
            </div>
            <div className="text-right font-mono text-xs text-ink-muted">
              <p>{s.payment_terms ?? "—"}</p>
              <p>{s.min_order_crc ? "Mín. " + colones(s.min_order_crc) : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
