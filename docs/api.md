# API REST

Base: `/api`. Respuestas en JSON. Importes como texto con dos decimales
(`"19000.00"`). Fechas en ISO 8601 (UTC).

**Formato de error** (siempre igual):

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Texto para el usuario", "details": {} } }
```

| HTTP | Cuándo |
|---|---|
| 400 | Datos inválidos (`VALIDATION_ERROR`, `INVALID_JSON`) |
| 401 | Sin sesión o sesión vencida (`UNAUTHENTICATED`, `INVALID_SESSION`) |
| 403 | Sesión válida sin permiso (`FORBIDDEN`) |
| 404 | No existe |
| 409 | Conflicto de negocio (stock, transición, idempotencia, precio cambiado…) |
| 413 | Cuerpo de más de 100 KB |
| 422 | Regla de negocio de entrada (zona, motivo de cancelación…) |
| 429 | Límite de solicitudes |

---

## Públicos (sin autenticación)

### `GET /api/health`
Estado del servicio. → `{ status: "ok", service, time }`

### `GET /api/settings`
Configuración visible para la tienda: nombre, WhatsApp, dirección, Instagram,
horario (`null` = pendiente), modalidades, `acceptingOrders`, zonas activas `[{ id, name, fee }]`.

### `GET /api/categories`
Categorías activas en orden. → `{ items: [{ id, slug, name, description }] }`

### `GET /api/products`
Query (todo opcional): `category` (slug), `q` (busca en nombre, descripción y
categoría), `featured=true`.
→ `{ items: Product[] }`. Solo productos activos de categorías activas. Los
agotados vienen con `available: false`.

```ts
Product = {
  id, slug, name, description, price, imageUrl, imageAlt, isFeatured, available,
  category: { id, slug, name },
  variants: [{ id, name, price }],              // si hay, elegir una es obligatorio
  optionGroups: [{ id, name, minSelect, maxSelect, options: [{ id, name, price }] }]
}
```

### `GET /api/products/:slug`
Un producto. `404 PRODUCT_NOT_FOUND` si no existe o está inactivo.

### `POST /api/cart/quote` — límite 60/min por IP
Cotiza el carrito con precios vigentes, sin crear pedido.

```json
{ "fulfillment": "DOMICILIO" | "RECOGIDA", "deliveryZoneId": "uuid|null",
  "items": [{ "productId": "uuid", "variantId": "uuid|null", "optionIds": ["uuid"], "quantity": 1, "notes": "sin cebolla" }] }
```
→ `{ lines, subtotal, deliveryFee (null = por confirmar), total, deliveryZone }`
Errores 409: `PRODUCT_UNAVAILABLE`, `VARIANT_REQUIRED`, `INVALID_VARIANT`,
`INVALID_OPTION`, `INVALID_OPTION_COUNT`, `INSUFFICIENT_STOCK`, `STORE_CLOSED`.
Errores 422: `ZONE_REQUIRED`, `ZONE_NOT_COVERED`, `FULFILLMENT_UNAVAILABLE`.

### `POST /api/orders` — límite 20 / 10 min por IP
Cabecera obligatoria: `Idempotency-Key: <uuid>`.

Cuerpo = cotización + `customerName` (2–80), `customerPhone` (celular o fijo
colombiano; acepta espacios y +57), `deliveryAddress` (obligatoria en
domicilio), `deliveryReference`, `notes`, `expectedTotal` (opcional: el total que
vio el cliente).

- `201` → `{ order, replayed: false }`
- `200` → `{ order, replayed: true }` (misma clave y mismo contenido)
- `409 IDEMPOTENCY_CONFLICT` (misma clave, otro contenido)
- `409 PRICE_CHANGED` con `details.quote` si `expectedTotal` no coincide
- más los errores de la cotización

`order` incluye `id`, `code` (`ARC-1001`…), `status`, datos del cliente, `items`
con nombres y precios congelados, `subtotal`, `deliveryFee`, `total`.

### `POST /api/orders/lookup` — límite 20 / 10 min por IP
`{ code, phone }` → estado, productos y totales. **No** devuelve dirección ni
datos de contacto. `404` si código y teléfono no coinciden.

---

## Panel (`/api/admin/*`)

Todas exigen `Authorization: Bearer <access_token de Supabase Auth>` de una
cuenta con rol y activa. Límite 300/min. Roles:

- **admin**: todo.
- **staff**: dashboard, pedidos, inventario y lectura del catálogo.

| Método y ruta | Rol | Descripción |
|---|---|---|
| `GET /me` | staff | Perfil de la sesión |
| `GET /dashboard?range=day\|week\|month` | staff | Métricas (ver reglas de negocio) |
| `GET /orders?status=A,B&from=AAAA-MM-DD&to=…&q=&page=&pageSize=` | staff | Lista paginada; fechas en hora de Bogotá; `q` busca código, nombre o teléfono |
| `GET /orders/:id` | staff | Detalle con historial |
| `PATCH /orders/:id/status` | staff | `{ status, note }`. `409 INVALID_TRANSITION` (con `details.allowed`), `409 INSUFFICIENT_STOCK` al confirmar, `422 CANCEL_REASON_REQUIRED` |
| `GET /products?q=&categoryId=&status=active\|inactive\|all` | staff | Incluye stock, variantes e inactivos |
| `GET /products/:id` | staff | |
| `POST /products` | admin | Crea (slug automático si no se envía) con `variants` y `optionGroupIds` |
| `PATCH /products/:id` | admin | Parcial. Variantes omitidas se **desactivan** (no se borran). El stock **no** se cambia aquí |
| `GET /categories` · `POST` · `PATCH /:id` | staff / admin | |
| `GET /option-groups` | staff | Grupos con sus opciones |
| `POST /option-groups` · `PATCH /option-groups/:id` | admin | |
| `POST /option-groups/:id/options` · `PATCH /options/:id` | admin | Precio y estado de adicionales |
| `GET /inventory?lowStock=true` | staff | Productos con inventario activo |
| `GET /inventory/movements?productId=&page=&pageSize=` | staff | Historial |
| `POST /inventory/movements` | staff | `{ productId, type: ENTRADA\|SALIDA\|AJUSTE, quantity, reason }`. `409 STOCK_NOT_TRACKED`, `409 INSUFFICIENT_STOCK` |
| `GET /settings` · `PATCH /settings` | admin | Incluye todas las zonas |
| `POST /delivery-zones` · `PATCH /delivery-zones/:id` | admin | `{ name, fee, isActive, sortOrder }` |

No hay endpoints para borrar productos, pedidos ni movimientos: se desactivan
o se cancelan para conservar el historial.
