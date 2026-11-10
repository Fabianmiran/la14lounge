@AGENTS.md

# Reglas del proyecto La 14 Lounge

Tienda y panel administrativo de licores en Costa Rica (Next.js + Supabase + Vercel). Interfaz en español.

## Cómo se trabaja
- La primera línea de cada archivo lleva `// [LA14 · MÓDULO · vN]`. Los paquetes se entregan como `LA14_N-MODULO_vX.zip`.
- Los cambios de base de datos viven en `db/LA14_SQL_<MODULO>_vN.sql` y deben poder correrse más de una vez sin romper nada.
- El dueño no es técnico en varias áreas: pocos archivos, pasos numerados y explicados desde cero.
- Antes de entregar: `npm run typecheck`, `npm run lint` y `npm run test:competencia` deben pasar.

## Seguridad (no negociable)
- RLS activo en todas las tablas. Los datos privados (costos, márgenes, clientes, pedidos, competencia) solo los lee `is_admin()`, que exige 2FA.
- Toda acción del panel empieza con `requireAdmin()`. Toda entrada de formulario se valida y se limita en longitud.
- Nunca claves ni tokens en el código ni en el chat. Nunca escribir en la base de producción sin prueba local, respaldo y autorización del dueño.
- Precios y costos de un pedido los calcula la base de datos, nunca el navegador.

## Reglas comerciales
- Margen = (precio de venta − costo total) / precio de venta. El menor precio de la competencia es una referencia, no una instrucción de vender por debajo del margen mínimo.
- Los precios del cliente nunca muestran costos ni proveedores.

## Monitor de competencia
- Solo lectura de páginas públicas: sin login, sin cuentas, sin compras. Respetar `robots.txt` y términos de uso. Pocas consultas con pausas.
- No activar ejecución periódica de una fuente hasta verificar su acceso permitido.
- Una promoción no se da por vigente sin fuente y fecha. Los datos simulados o de capturas viejas nunca se guardan como observaciones reales.
