# Validación (Fase 7)

Resultado de la revisión de calidad, seguridad, accesibilidad y rendimiento.
Fecha: 2026-10-29. Entorno: Supabase local (Docker), Node 24.15.

## Pruebas automáticas

| Suite | Cantidad | Qué cubre |
|---|---|---|
| Base de datos (pgTAP) | 16 | RLS y privilegios, restricciones (stock ≥ 0, totales, idempotencia), historial de solo inserción, carta cargada, perfil sin rol |
| Backend unitarias | 43 | Dinero en centavos, precios del carrito, transiciones, horario, validadores (incluido el saneamiento de texto), entorno, cabeceras |
| Backend integración | 32 | Pedidos e idempotencia (también concurrente), stock al confirmar y reversión al cancelar, confirmaciones simultáneas, auth y roles, acceso directo a tablas, inventario, estadísticas, zonas, tienda cerrada, caché y compresión |
| Frontend | 31 | Carrito, mensaje de WhatsApp, clave anti-duplicados, formulario de pedido, errores de red y de servidor, componentes |

```bash
npm run lint && npm run typecheck && npm test && npm run db:test && npm run build
```

Todas pasan. `npm audit`: 0 vulnerabilidades.

## Seguridad

Revisado: secretos (repositorio, historial de Git y bundle del navegador),
autorización por rol en cada ruta, consultas parametrizadas, límites de tamaño
y de solicitudes, cabeceras, CORS, caché de datos personales, datos que viajan
en la URL, mensajes de error.

Hallazgos corregidos en esta fase:

1. **IP falsificable**: `trust proxy` estaba fijo en 1. Sin un proxy real
   delante, cualquiera podía enviar `X-Forwarded-For` y saltarse el límite de
   pedidos. Ahora es `TRUST_PROXY` (0 por defecto).
2. **Mensaje de WhatsApp manipulable**: un salto de línea en el nombre o las
   notas permitía escribir una línea falsa como `*Total: $ 1.000*`. Ahora el
   texto libre se normaliza a una sola línea.
3. **Sin tiempo máximo en consultas**: se agregó `statement_timeout` (10 s).
4. **Respuestas cacheables**: el panel y los pedidos ahora envían `no-store`.

Confirmado sin cambios: la clave `service_role` no está en el bundle (la clave
anon sí, por diseño); ningún secreto en el historial de Git.

## Accesibilidad

Auditoría con axe-core (WCAG 2.1 A/AA + buenas prácticas) en 16 pantallas:
inicio, menú, hoja de producto, carrito vacío y con productos, formulario con
errores, consulta, 404, login y las 7 pantallas del panel.

Corregido: encabezado y pie duplicados dentro del diálogo de producto, títulos
`h1` faltantes (carrito vacío, 404), orden de títulos en el carrito, región
principal faltante en el login. Resultado final: **0 violaciones**.

## Rendimiento

| Medida | Antes | Después |
|---|---|---|
| JS principal de la tienda (gzip) | 157 KB | 143 KB (LazyMotion) |
| Peticiones a terceros al cargar | Google Fonts (CSS + fuentes) | 0 (fuentes propias, 72 KB, solo latín) |
| `GET /api/products` | 66 KB | 4,3 KB con gzip |
| Latencia local (mediana) | — | 4–9 ms catálogo, 7 ms cotización |

El panel y las páginas del pedido se cargan bajo demanda; la tienda no descarga
el cliente de autenticación.

## Prueba de punta a punta (navegador)

1. Carrito con un producto que ya no existe → se marca y bloquea el pedido.
2. Ranchera + tocineta, a domicilio, con un intento de línea falsa en las notas.
3. Pedido `ARC-1001` creado: $29.500 + domicilio por confirmar; el mensaje de
   WhatsApp mantiene las notas en una sola línea.
4. Panel: confirmar → preparación → listo → en camino → entregado.
5. Dashboard: ingresos $29.500, Ranchera como más vendido.

## No verificado aquí

- Envío real del mensaje por WhatsApp (abriría un chat con el número real del restaurante).
- Animaciones: el navegador integrado de esta herramienta pausa los cuadros de
  animación; se validó el contenido, no el movimiento. Revisar en un celular.
- Rendimiento en una red móvil real y en el hosting de producción (Fase 8).
- Subida de fotos (Cloudinary): pendiente de credenciales.
