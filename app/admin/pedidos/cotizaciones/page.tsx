// [LA14 · PEDIDOS · v1] app/admin/pedidos/cotizaciones/page.tsx
// La lista de cotizaciones ahora vive dentro de Pedidos. Esta ruta solo redirige (por si hay enlaces viejos).
import { redirect } from "next/navigation";

export default function Cotizaciones() {
  redirect("/admin/pedidos?v=cotizaciones");
}
