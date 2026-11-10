# LA14 · COTIZADOR · v1

Cotizaciones dentro de **Pedidos**: armas la cotización, la mandas por WhatsApp o la imprimes en PDF,
y cuando el cliente acepta se convierte en pedido con los mismos precios.

## Qué contiene este paquete
- `db/LA14_SQL_COTIZADOR_v1.sql` → crea las tablas y funciones (se puede correr varias veces).
- `app/admin/pedidos/cotizaciones/` → lista/crear, vista interna (con costos) y vista del cliente (sin costos).
- `lib/cotizador.ts`, `components/PrintButton.tsx`, `scripts/test-cotizador-*.ts`.
- Modificados: `app/admin/pedidos/page.tsx` (botón "Cotizaciones"), `app/admin/layout.tsx` (oculta menú al imprimir), `package.json`.

## Instalar (en este orden)
1. Descomprime el zip y **copia la carpeta `la14lounge` encima** de la tuya (acepta reemplazar).
2. En la terminal, dentro del proyecto: `npm run typecheck` y `npm run test:cotizador` (deben terminar sin errores).
3. Supabase → SQL Editor → New query → nómbrala `LA14_SQL_COTIZADOR_v1` → pega el contenido del `.sql` → Run.
   Debe decir "Success. No rows returned".
4. Git: `git add .` → `git commit -m "Cotizador v1"` → `git push` (rama monitor-integracion). Vercel publica solo.
5. Entra a `/admin/pedidos` → botón **Cotizaciones**.

## Cómo se usa
1. Elige cliente (o escribe un nombre), zona, productos, cantidades y descuento % por línea.
2. En la vista interna ves costo y margen; las líneas bajo el margen mínimo salen con ⚠.
3. "Vista del cliente" → **Enviar por WhatsApp** o **Imprimir / guardar PDF**. Nunca muestra costos.
4. Si acepta: **Cliente aceptó → crear pedido**. Si pasa la vigencia, ya no se puede aceptar.

## Importante
- Los precios de venta incluyen IVA (así están en el catálogo). Confirma con tu contador cómo facturar.
- Sin costos de proveedor cargados, el margen dice "no se puede calcular". Carga la lista de precios para activarlo.
