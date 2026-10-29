import { createHash } from 'node:crypto'
import { canTransition, allowedTransitions, type Fulfillment, type OrderStatus } from '../domain/order-status.js'
import { CartError, priceCart, type CartLineInput, type DeliveryQuote, type Quote } from '../domain/pricing.js'
import { isOpenAt } from '../domain/schedule.js'
import { audit } from '../lib/audit.js'
import { isPgError, pool, PG_UNIQUE_VIOLATION, withTransaction } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import { loadCatalogForCart } from '../repositories/catalog.repository.js'
import {
  findOrderById,
  findOrderByIdempotencyKey,
  insertOrder,
  insertStatusHistory,
  lockOrder,
  updateOrderStatus,
  type OrderDetail,
} from '../repositories/orders.repository.js'
import { getSettings, listDeliveryZones } from '../repositories/settings.repository.js'
import { deductStockForOrder, revertStockForOrder } from './inventory.service.js'

export type QuoteInput = {
  // Sin modalidad solo se validan productos y precios (carrito).
  fulfillment?: Fulfillment
  deliveryZoneId?: string | null
  items: CartLineInput[]
}

export type CreateOrderInput = QuoteInput & {
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  deliveryAddress?: string | null
  deliveryReference?: string | null
  notes?: string | null
  // Total que el cliente vio en el carrito. Si no coincide con el vigente, se
  // responde 409 PRICE_CHANGED con la cotización nueva para que la revise.
  expectedTotal?: string
}

// Valida modalidad, horario y zona de domicilio según la configuración real.
async function resolveDelivery(input: QuoteInput & { fulfillment: Fulfillment }, now = new Date()): Promise<DeliveryQuote> {
  const settings = await getSettings(pool)
  if (!settings.acceptingOrders) {
    throw new HttpError(409, 'STORE_CLOSED', 'En este momento no estamos recibiendo pedidos en línea')
  }
  if (!isOpenAt(settings.openingHours, now, settings.timezone)) {
    throw new HttpError(409, 'STORE_CLOSED', 'Estamos cerrados en este momento. Revisa nuestro horario')
  }
  if (input.fulfillment === 'DOMICILIO' && !settings.deliveryEnabled) {
    throw new HttpError(422, 'FULFILLMENT_UNAVAILABLE', 'Los domicilios no están disponibles en este momento')
  }
  if (input.fulfillment === 'RECOGIDA' && !settings.pickupEnabled) {
    throw new HttpError(422, 'FULFILLMENT_UNAVAILABLE', 'La recogida en el local no está disponible en este momento')
  }
  if (input.fulfillment === 'RECOGIDA') return null

  const zones = await listDeliveryZones(pool, true)
  // Sin zonas configuradas, el domicilio queda "por confirmar" por WhatsApp.
  if (zones.length === 0) return null
  if (!input.deliveryZoneId) throw new HttpError(422, 'ZONE_REQUIRED', 'Elige el barrio o zona de entrega')
  const zone = zones.find((z) => z.id === input.deliveryZoneId)
  if (!zone) throw new HttpError(422, 'ZONE_NOT_COVERED', 'No tenemos cobertura de domicilio en esa zona')
  return { zoneId: zone.id, zoneName: zone.name, fee: zone.fee }
}

export async function quoteCart(input: QuoteInput): Promise<Quote> {
  const delivery = input.fulfillment ? await resolveDelivery({ ...input, fulfillment: input.fulfillment }) : null
  const catalog = await loadCatalogForCart(
    pool,
    [...new Set(input.items.map((i) => i.productId))],
  )
  try {
    return priceCart(input.items, catalog, delivery)
  } catch (err) {
    if (err instanceof CartError) throw new HttpError(409, err.code, err.message, err.details)
    throw err
  }
}

// Huella del contenido del pedido: si el mismo Idempotency-Key llega con otro
// contenido, es un error del cliente y no se reutiliza el pedido.
function hashRequest(input: CreateOrderInput): string {
  const { expectedTotal: _ignored, ...content } = input
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

export async function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<{ order: OrderDetail; replayed: boolean }> {
  const requestHash = hashRequest(input)

  const replay = async () => {
    const existing = await findOrderByIdempotencyKey(pool, idempotencyKey)
    if (!existing) return null
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Esta clave de pedido ya se usó con otro contenido')
    }
    return { order: (await findOrderById(pool, existing.id))!, replayed: true }
  }

  const previous = await replay()
  if (previous) return previous

  const quote = await quoteCart(input)
  if (input.expectedTotal !== undefined && input.expectedTotal !== quote.total) {
    throw new HttpError(409, 'PRICE_CHANGED', 'Los precios o la disponibilidad cambiaron. Revisa tu pedido', { quote })
  }

  try {
    const orderId = await withTransaction((client) =>
      insertOrder(client, {
        idempotencyKey,
        requestHash,
        fulfillment: input.fulfillment,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone,
        deliveryAddress: input.fulfillment === 'DOMICILIO' ? (input.deliveryAddress?.trim() ?? null) : null,
        deliveryReference: input.fulfillment === 'DOMICILIO' ? input.deliveryReference?.trim() || null : null,
        notes: input.notes?.trim() || null,
        quote,
      }),
    )
    return { order: (await findOrderById(pool, orderId))!, replayed: false }
  } catch (err) {
    // Dos reintentos simultáneos con la misma clave: gana uno, el otro lo reutiliza.
    if (isPgError(err, PG_UNIQUE_VIOLATION) && err.constraint === 'orders_idempotency_key_key') {
      const raced = await replay()
      if (raced) return raced
    }
    throw err
  }
}

export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  actorId: string,
  note?: string | null,
): Promise<OrderDetail> {
  await withTransaction(async (client) => {
    const order = await lockOrder(client, orderId)
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'El pedido no existe')
    if (!canTransition(order.status, to, order.fulfillment)) {
      throw new HttpError(409, 'INVALID_TRANSITION', `Un pedido ${order.status} no puede pasar a ${to}`, {
        from: order.status,
        allowed: allowedTransitions(order.status, order.fulfillment),
      })
    }
    if (to === 'CANCELADO' && !note?.trim()) {
      throw new HttpError(422, 'CANCEL_REASON_REQUIRED', 'Indica el motivo de la cancelación')
    }

    const { rows } = await client.query<{ code: string }>('select code from public.orders where id = $1', [orderId])
    const ref = { id: orderId, code: rows[0]!.code }
    let stockApplied: boolean | undefined

    if (to === 'CONFIRMADO') {
      stockApplied = await deductStockForOrder(client, ref, actorId)
    } else if (to === 'CANCELADO' && order.stockApplied) {
      await revertStockForOrder(client, ref, actorId)
      stockApplied = false
    }

    await updateOrderStatus(client, orderId, to, { stockApplied, cancelReason: to === 'CANCELADO' ? note!.trim() : null })
    await insertStatusHistory(client, { orderId, fromStatus: order.status, toStatus: to, note: note?.trim() || null, changedBy: actorId })
    await audit(client, {
      actorId,
      action: 'order.status',
      entity: 'order',
      entityId: orderId,
      data: { from: order.status, to },
    })
  })
  return (await findOrderById(pool, orderId, true))!
}
