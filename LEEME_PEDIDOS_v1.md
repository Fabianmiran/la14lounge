# LA14 · PEDIDOS · v1  (pantalla única + reserva de inventario)

## Qué cambia
- **Pedidos** es una sola pantalla: botones **+ Cotizar** y **+ Pedido directo**, y pestañas
  Cotizaciones · Por entregar · Entregados · Cerrados.
- **Inventario con reserva:** disponible = físico − reservado por pedidos abiertos.
  - Cotizar NO reserva. Aceptar la cotización o crear un pedido SÍ reserva, y si no alcanza el stock se rechaza sin cambiar nada.
  - Cancelar un pedido libera la reserva sola. Entregar descuenta lo físico (una sola vez).
  - Borrar una cotización que no se aceptó no toca el inventario. Una aceptada no se borra: se cancela su pedido.
- **Bitácora (audit_log):** queda registro de cotizaciones aceptadas, borradas y pedidos cancelados.

## Importante
- Para aceptar o crear pedidos, el producto necesita stock: regístralo en **Inventario → Entrada (compra)**.
- El pedido que ya estaba "en ruta" cuenta como reservado hasta que lo entregues o cancelers.
- Corre el SQL ANTES de subir el código.
