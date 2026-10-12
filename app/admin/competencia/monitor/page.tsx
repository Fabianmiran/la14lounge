// [LA14 · COMPETENCIA · MONITOR · v1]
import { createClient } from "@/lib/supabase/server";

export default async function MonitorCompetencia() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("monitor_runs")
    .select("id, started_at, finished_at, status, sources_checked, products_found, promotions_found, price_changes_found, availability_changes_found, error_count")
    .order("started_at", { ascending: false })
    .limit(12);

  const { data: errors } = await supabase
    .from("monitor_errors")
    .select("id, monitor_run_id, error_type, error_message, created_at, competitor_id")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Monitor de competencia</h1>
          <p className="mt-1 text-sm text-ink-muted">Histórico de ejecuciones automáticas.</p>
        </div>
        <a href="/admin/competencia" className="text-sm text-ink-muted hover:text-ink">← Buscar precios</a>
      </div>

      <section className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            <tr className="border-b border-rule">
              <th className="py-2 font-normal">Fecha</th>
              <th className="font-normal">Estado</th>
              <th className="text-right font-normal">Fuentes</th>
              <th className="text-right font-normal">Productos</th>
              <th className="text-right font-normal">Promos</th>
              <th className="text-right font-normal">Precios</th>
              <th className="text-right font-normal">Disponibilidad</th>
              <th className="text-right font-normal">Errores</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {(runs ?? []).map((run) => (
              <tr key={run.id} className="border-b border-rule">
                <td className="py-3">{new Date(run.started_at).toLocaleString("es-CR")}</td>
                <td>{run.status}</td>
                <td className="text-right">{run.sources_checked}</td>
                <td className="text-right">{run.products_found}</td>
                <td className="text-right">{run.promotions_found}</td>
                <td className="text-right">{run.price_changes_found}</td>
                <td className="text-right">{run.availability_changes_found}</td>
                <td className="text-right">{run.error_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!runs || runs.length === 0) && <p className="border-y border-rule py-6 text-sm text-ink-muted">Aún no hay ejecuciones. El monitor se ejecuta semanalmente desde GitHub Actions.</p>}
      </section>

      <section className="mt-10 bg-surface p-6">
        <h2 className="font-serif text-2xl">Configuración</h2>
        <ul className="mt-3 space-y-1 text-sm text-ink-muted">
          <li>• Frecuencia: lunes, 8:00 a. m. hora Costa Rica.</li>
          <li>• También puede ejecutarse manualmente desde GitHub Actions.</li>
          <li>• Reporte por correo mediante Resend.</li>
          <li>• No realiza login, compras, checkout ni modificaciones en las tiendas.</li>
        </ul>
      </section>

      {errors && errors.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl">Últimas incidencias</h2>
          <ul className="mt-3 divide-y divide-rule text-sm">
            {errors.map((error) => <li key={error.id} className="py-3"><span className="font-mono text-xs text-ink-faint">{error.error_type}</span><p className="text-ink-muted">{error.error_message}</p></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
