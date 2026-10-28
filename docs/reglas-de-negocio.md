# Reglas de negocio

Estas reglas están implementadas en el backend y cubiertas por pruebas. Si el
restaurante quiere cambiar alguna, se cambia aquí y en el código.

## Precios

- El backend **siempre** calcula los importes con los precios vigentes en la base
  de datos. El navegador nunca envía precios (si los envía, se ignoran).
- Productos con **variantes** (hot dogs y salchipapas: Zenú / Americana): la
  variante es obligatoria y su precio reemplaza al precio base.
- **Adicionales**: se suman al precio unitario. Un adicional repetido en la misma
  línea se cobra una sola vez. Cada grupo puede tener mínimo y máximo de elecciones.
- Precio unitario = base (o variante) + adicionales. Total de línea = unitario × cantidad.
- Todos los importes son `NUMERIC(12,2)` en la base y se calculan en centavos
  enteros en el código (sin errores de punto flotante).
- Cada pedido guarda una **copia** de nombres y precios. Cambiar un producto
  después no altera pedidos anteriores.

## Domicilio

- Si **no hay zonas activas** configuradas (situación actual), el domicilio queda
  *por confirmar*: el pedido se guarda con `deliveryFee = null` y el total no lo
  incluye. El restaurante lo confirma por WhatsApp.
- Si **hay zonas activas**, el cliente debe elegir una; si no está en la lista,
  el pedido se rechaza (`ZONE_NOT_COVERED`). La tarifa sale de la zona.
- Recogida en el local: sin dirección ni tarifa.

## Horario

- Sin horario configurado (situación actual) no se bloquean pedidos.
- Con horario configurado, fuera de horario se rechaza el pedido (`STORE_CLOSED`).
  Se interpreta en hora de Bogotá y admite turnos que pasan la medianoche.
- El interruptor *"Recibiendo pedidos"* del panel desactiva la tienda en cualquier momento.

## Disponibilidad

Un producto se puede comprar solo si:
- está **activo** (si no, ni siquiera aparece en la tienda),
- está **disponible** (si no, aparece como *agotado*),
- su **categoría** está activa,
- y, si controla inventario, le quedan existencias.

## Estados del pedido

```
Domicilio: PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → EN_CAMINO → ENTREGADO
Recogida:  PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → ENTREGADO
Cualquier estado no final → CANCELADO (con motivo obligatorio)
```

- No se pueden saltar estados ni volver atrás. ENTREGADO y CANCELADO son finales.
- Abrir WhatsApp **no** cambia el estado. El pedido queda PENDIENTE hasta que
  alguien del restaurante lo confirme en el panel.
- No hay estado de "pagado": la primera versión no registra pagos.
- Cada cambio queda en el historial con usuario, fecha y nota.

## Inventario

- El control de existencias es **opcional por producto** (`trackStock`). Al
  inicio está desactivado en todos: se activa cuando se haga el primer conteo
  (normalmente bebidas y productos que se compran hechos).
- Las existencias se descuentan **al confirmar** el pedido (PENDIENTE → CONFIRMADO),
  nunca al crearlo ni al abrir WhatsApp.
- Al crear el pedido se verifica que haya stock suficiente, pero no se reserva.
  Si al confirmar ya no alcanza, la confirmación se rechaza (`INSUFFICIENT_STOCK`)
  y no se descuenta nada.
- **Cancelación**: si el pedido ya había descontado existencias, se devuelven
  exactamente las unidades descontadas (movimiento `REVERSION_PEDIDO`). Si hubo
  merma real (por ejemplo, comida ya preparada), se registra después una
  `SALIDA` manual con el motivo.
- Movimientos manuales: `ENTRADA` (suma), `SALIDA` (resta) y `AJUSTE` (fija la
  cantidad contada). Todos exigen motivo y guardan usuario y fecha.
- El stock nunca puede quedar negativo (restricción en la base y validación en
  el backend). Las operaciones bloquean la fila del producto (`FOR UPDATE`),
  así dos confirmaciones simultáneas no venden la misma unidad.
- El historial de movimientos es de solo inserción.

## Estadísticas

| Concepto | Definición |
|---|---|
| Pedido recibido | Cualquier pedido creado en el periodo, en cualquier estado |
| Pedido confirmado | Pedido que pasó a CONFIRMADO (lo aceptó el restaurante) |
| Venta completada | Pedido ENTREGADO; cuenta en la fecha de **entrega** |
| Ingresos | Suma del total (productos + domicilio) de los pedidos ENTREGADOS |
| Excluidos de ingresos | PENDIENTE, CONFIRMADO, EN_PREPARACION, LISTO, EN_CAMINO y CANCELADO |
| Ticket promedio | Ingresos ÷ número de pedidos entregados |
| Productos más vendidos | Unidades de pedidos ENTREGADOS en el periodo |
| Stock bajo | Productos con inventario activo y `existencias ≤ mínimo` |

- Los periodos se calculan en **hora de Bogotá**: *día* desde las 00:00, *semana*
  desde el lunes, *mes* desde el día 1.
- "Ingresos" son **ingresos registrados**, no pagos recibidos: el sistema no
  confirma pagos.
- La cola operativa del dashboard (pendientes, en preparación…) muestra los
  pedidos activos de cualquier fecha.

## Idempotencia (pedidos duplicados)

- Cada intento de pedido lleva una clave única (`Idempotency-Key`, un UUID que
  genera el navegador y conserva mientras el carrito no cambie).
- Si la misma clave llega otra vez con el mismo contenido (doble clic, red
  inestable), se devuelve **el mismo pedido** (HTTP 200, `replayed: true`).
- Si llega con contenido distinto → `409 IDEMPOTENCY_CONFLICT`.
- La base tiene una restricción única sobre la clave, que cubre también
  reintentos simultáneos.
