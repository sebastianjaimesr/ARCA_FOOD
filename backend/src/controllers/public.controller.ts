import type { RequestHandler } from 'express'
import { z } from 'zod'
import { pool } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import { findPublicProductBySlug, listPublicCategories, listPublicProducts } from '../repositories/catalog.repository.js'
import { findOrderByCodeAndPhone } from '../repositories/orders.repository.js'
import { getSettings, listDeliveryZones } from '../repositories/settings.repository.js'
import { createOrder, quoteCart } from '../services/orders.service.js'
import { slug } from '../validators/common.js'
import { createOrderSchema, idempotencyKeySchema, orderLookupSchema, quoteSchema } from '../validators/orders.validators.js'

// Configuración visible para la tienda (sin datos internos).
export const getPublicSettings: RequestHandler = async (_req, res) => {
  const [settings, zones] = await Promise.all([getSettings(pool), listDeliveryZones(pool, true)])
  res.json({
    businessName: settings.businessName,
    tagline: settings.tagline,
    whatsappPhone: settings.whatsappPhone,
    address: settings.address,
    city: settings.city,
    instagramHandle: settings.instagramHandle,
    logoUrl: settings.logoUrl,
    currency: settings.currency,
    timezone: settings.timezone,
    openingHours: settings.openingHours,
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    acceptingOrders: settings.acceptingOrders,
    deliveryNotes: settings.deliveryNotes,
    deliveryZones: zones.map(({ id, name, fee }) => ({ id, name, fee })),
  })
}

export const getCategories: RequestHandler = async (_req, res) => {
  res.json({ items: await listPublicCategories(pool) })
}

const productsQuery = z.object({
  category: slug.optional(),
  q: z.string().trim().max(80).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const getProducts: RequestHandler = async (req, res) => {
  const query = productsQuery.parse(req.query)
  res.json({ items: await listPublicProducts(pool, { categorySlug: query.category, q: query.q, featured: query.featured }) })
}

export const getProduct: RequestHandler = async (req, res) => {
  const product = await findPublicProductBySlug(pool, slug.parse(req.params.slug))
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado')
  res.json(product)
}

// Cotiza el carrito con precios vigentes sin crear el pedido.
export const postQuote: RequestHandler = async (req, res) => {
  res.json(await quoteCart(quoteSchema.parse(req.body)))
}

export const postOrder: RequestHandler = async (req, res) => {
  const idempotencyKey = idempotencyKeySchema.parse(req.get('Idempotency-Key'))
  const input = createOrderSchema.parse(req.body)
  const { order, replayed } = await createOrder(input, idempotencyKey)
  res.status(replayed ? 200 : 201).json({ order, replayed })
}

// Consulta de un pedido por código + teléfono. No devuelve la dirección.
export const postOrderLookup: RequestHandler = async (req, res) => {
  const { code, phone } = orderLookupSchema.parse(req.body)
  const order = await findOrderByCodeAndPhone(pool, code, phone)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'No encontramos un pedido con ese código y teléfono')
  res.json({
    code: order.code,
    status: order.status,
    fulfillment: order.fulfillment,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt: order.createdAt,
  })
}
