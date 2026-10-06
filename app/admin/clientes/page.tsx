// [LA14 · VENTAS · v1] app/admin/clientes/page.tsx
import { createClient } from "@/lib/supabase/server";
import { createCustomer } from "./actions";

const input = "w-full border border-rule bg-background p-2 text-sm outline-none focus:border-ink-muted";
const label = "text-[10px] uppercase tracking-[0.18em] text-ink-faint";
const ERRORS: Record<string, string> = {
  nombre: "El nombre es obligatorio.",
  correo: "El correo no parece válido.",
  repetido: "Ya existe un cliente con ese WhatsApp.",
  guardar: "No se pudo guardar. Intenta de nuevo.",
};

type C = { id: number; name: string; whatsapp: string | null; type: string; canton: string | null };

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, whatsapp, type, canton")
    .order("created_at", { ascending: false })
    .limit(200);
  const customers = (data ?? []) as C[];

  return (
    <>
      <h1 className="font-serif text-3xl">Clientes</h1>
      {ok && <p className="mt-3 font-mono text-xs text-ink-muted">✓ Cliente guardado.</p>}
      {error && <p className="mt-3 font-mono text-xs text-alarm">{ERRORS[error] ?? "Ocurrió un error."}</p>}

      <form action={createCustomer} className="mt-6 grid gap-4 border-y border-rule py-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className={label}>Nombre *</p>
          <input name="name" required maxLength={120} className={input} />
        </div>
        <div>
          <p className={label}>WhatsApp (solo números, con 506)</p>
          <input name="whatsapp" inputMode="numeric" maxLength={20} className={input} />
        </div>
        <div>
          <p className={label}>Otro teléfono</p>
          <input name="phone" maxLength={30} className={input} />
        </div>
        <div>
          <p className={label}>Correo</p>
          <input name="email" type="email" maxLength={254} className={input} />
        </div>
        <div>
          <p className={label}>Tipo</p>
          <select name="type" className={input} defaultValue="particular">
            <option value="particular">Particular</option>
            <option value="negocio">Negocio (bar, evento, oficina)</option>
          </select>
        </div>
        <div>
          <p className={label}>Cantón / zona</p>
          <input name="canton" maxLength={80} className={input} />
        </div>
        <div>
          <p className={label}>Dirección de entrega</p>
          <input name="address" maxLength={300} className={input} />
        </div>
        <button className="rounded-full bg-ink px-6 py-2 font-mono text-xs uppercase tracking-[0.2em] text-background hover:opacity-90 sm:col-span-2 sm:w-fit">
          Guardar cliente
        </button>
      </form>

      <ul className="mt-6 divide-y divide-rule">
        {customers.length === 0 && <li className="py-4 text-ink-muted">Aún no hay clientes.</li>}
        {customers.map((c) => (
          <li key={c.id} className="grid grid-cols-[1fr_auto] gap-4 py-3">
            <p className="font-serif text-lg">{c.name}</p>
            <p className="text-right font-mono text-xs text-ink-muted">
              {[c.type === "negocio" ? "Negocio" : null, c.canton, c.whatsapp].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
