// Implementación sin backend de los servicios públicos (modo vitrina).
// Reutiliza las reglas del backend en vez de copiarlas:
//   - priceCart: el mismo cálculo de precios, variantes, adicionales y stock.
//   - createOrderSchema: la misma validación y saneamiento de los datos.
import { CartError, priceCart, type CatalogProduct } from '../../../backend/src/domain/pricing.ts'
import { createOrderSchema } from '../../../backend/src/validators/orders.validators.ts'
import snapshot from '../static/catalog.json'
import type { Category, Product, PublicSettings, Quote } from '../types/catalog'
import type { Order } from '../types/order'
import { ApiError } from './api'
import type { QuoteRequest } from './catalog'
import type { CreateOrderBody } from './orders'

const settings = snapshot.settings as PublicSettings
const categories = snapshot.categories as Category[]
const products = snapshot.products as Product[]

export const staticSettings = () => Promise.resolve(settings)
export const staticCategories = () => Promise.resolve(categories)
export const staticProducts = () => Promise.resolve(products)

// El catálogo exportado ya trae "available" calculado (activo, disponible y con stock).
const catalog = new Map<string, CatalogProduct>(
  products.map((p) => [
    p.id,
    {
      id: p.id,
      name: p.name,
      price: p.price,
      sellable: p.available,
      trackStock: false,
      stockQuantity: 0,
      variants: p.variants,
      optionGroups: p.optionGroups.map(({ options: _o, ...group }) => group),
      options: p.optionGroups.flatMap((g) => g.options.map((o) => ({ ...o, groupId: g.id, groupName: g.name }))),
    },
  ]),
)

function delivery(fulfillment: QuoteRequest['fulfillment'], zoneId: string | null | undefined) {
  if (fulfillment !== 'DOMICILIO' || settings.deliveryZones.length === 0) return null
  const zone = settings.deliveryZones.find((z) => z.id === zoneId)
  if (!zone) throw new ApiError(422, zoneId ? 'ZONE_NOT_COVERED' : 'ZONE_REQUIRED', 'Elige el barrio o zona de entrega')
  return { zoneId: zone.id, zoneName: zone.name, fee: zone.fee }
}

function price(items: QuoteRequest['items'], fulfillment: QuoteRequest['fulfillment'], zoneId?: string | null): Quote {
  try {
    return priceCart(
      items.map((i) => ({ ...i, optionIds: i.optionIds ?? [] })),
      catalog,
      delivery(fulfillment, zoneId),
    )
  } catch (err) {
    if (err instanceof CartError) throw new ApiError(409, err.code, err.message, err.details)
    throw err
  }
}

export async function staticQuote(body: QuoteRequest): Promise<Quote> {
  return price(body.items, body.fulfillment, body.deliveryZoneId)
}

// Referencia legible para el mensaje de WhatsApp. No es un consecutivo de la
// base de datos: en el modo vitrina los pedidos no se registran.
function reference() {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase()
  const random = crypto.getRandomValues(new Uint8Array(2)).reduce((s, b) => s + b.toString(36).padStart(2, '0'), '').toUpperCase()
  return `WEB-${stamp}${random.slice(0, 3)}`
}

export async function staticCreateOrder(body: CreateOrderBody): Promise<{ order: Order; replayed: boolean }> {
  if (!settings.acceptingOrders) throw new ApiError(409, 'STORE_CLOSED', 'En este momento no estamos recibiendo pedidos en línea')

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ApiError(400, 'VALIDATION_ERROR', first?.message ?? 'Datos inválidos', parsed.error.issues)
  }
  const input = parsed.data
  const quote = price(input.items, input.fulfillment, input.deliveryZoneId)
  if (input.expectedTotal !== undefined && input.expectedTotal !== quote.total) {
    throw new ApiError(409, 'PRICE_CHANGED', 'Los precios o la disponibilidad cambiaron. Revisa tu pedido', { quote })
  }

  const order: Order = {
    id: crypto.randomUUID(),
    code: reference(),
    status: 'PENDIENTE',
    fulfillment: input.fulfillment,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.fulfillment === 'DOMICILIO' ? input.deliveryAddress : null,
    deliveryReference: input.fulfillment === 'DOMICILIO' ? input.deliveryReference : null,
    deliveryZoneName: quote.deliveryZone?.name ?? null,
    notes: input.notes,
    subtotal: quote.subtotal,
    deliveryFee: quote.deliveryFee,
    total: quote.total,
    createdAt: new Date().toISOString(),
    items: quote.lines.map((line, index) => ({
      id: `${index}`,
      productId: line.productId,
      productName: line.productName,
      variantName: line.variantName,
      options: line.options.map(({ groupName, name, price }) => ({ groupName, name, price })),
      basePrice: line.basePrice,
      optionsPrice: line.optionsPrice,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      notes: line.notes,
    })),
  }
  return { order, replayed: false }
}
